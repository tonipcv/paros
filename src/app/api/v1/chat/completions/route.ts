import { recordUsage, refundCredits, reserveCredits } from "@/lib/account";
import { recordModelRouteOutcome, resolveCatalogModel } from "@/lib/model-catalog";
import { providerApiKey } from "@/lib/provider-credentials";
import { authenticateApiKey } from "@/lib/api-auth";
import { searchWeb, buildSearchContext } from "@/lib/web-search";
import { detectPromptInjection } from "@/lib/prompt-injection";
import { estimateTokens } from "@/lib/account";
import { estimateCatalogTextRequest } from "@/lib/billing-pricing";
import { createBillingReservation, markBillingSent, releaseBillingReservation } from "@/lib/billing-engine";
import { meterOpenAIResponse } from "@/lib/metered-provider-response";

export const runtime = "nodejs";

const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const MAX_OUTPUT_TOKENS = 8192;
const MAX_BODY_BYTES = 256 * 1024;

function clamp(n: unknown, min: number, max: number): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined;
}

function messageText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => part && typeof part === "object" && (part as { type?: unknown }).type === "text"
    ? String((part as { text?: unknown }).text || "") : "").join("\n");
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: { message: auth.message } },
      { status: auth.status, headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {} }
    );
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: { message: "Request body too large" } }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: { message: "messages is required" } }, { status: 400 });
  }

  const modelId = typeof body.model === "string" ? body.model : "";
  const model = await resolveCatalogModel(modelId, "TEXT");
  if (!model) {
    return Response.json(
      { error: { message: `Model '${modelId || "(missing)"}' does not exist`, type: "invalid_request_error", param: "model", code: "model_not_found" } },
      { status: 404 }
    );
  }

  if (!model.capabilities.uncensored) {
    for (const msg of body.messages as Array<{ content?: unknown }>) {
      if (typeof msg?.content === "string" && detectPromptInjection(msg.content).detected) {
        return Response.json({ error: { message: "Content blocked" } }, { status: 400 });
      }
    }
  }
  if (!(await reserveCredits(auth.workspace.id, model.credits))) {
    return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  }

  // Allowlist forwarded params — never proxy arbitrary fields — and cap output
  // tokens so a single flat-priced request can't run up unbounded cost.
  const modelOutputLimit = Math.min(MAX_OUTPUT_TOKENS, model.maxOutputTokens || MAX_OUTPUT_TOKENS);
  const requested = clamp(body.max_tokens, 1, modelOutputLimit);
  const payload: Record<string, unknown> = {
    model: model.route.providerModelId,
    messages: body.messages,
    max_tokens: requested ?? modelOutputLimit,
    stream: Boolean(body.stream),
  };
  const temperature = clamp(body.temperature, 0, 2);
  if (temperature !== undefined) payload.temperature = temperature;
  const topP = clamp(body.top_p, 0, 1);
  if (topP !== undefined) payload.top_p = topP;
  const presence = clamp(body.presence_penalty, -2, 2);
  if (presence !== undefined) payload.presence_penalty = presence;
  const frequency = clamp(body.frequency_penalty, -2, 2);
  if (frequency !== undefined) payload.frequency_penalty = frequency;
  if (typeof body.stop === "string" || Array.isArray(body.stop)) payload.stop = body.stop;
  if (Array.isArray(body.tools) && body.tools.length > 0) payload.tools = body.tools;
  if (typeof body.tool_choice === "string" || typeof body.tool_choice === "object") payload.tool_choice = body.tool_choice;
  if (typeof body.reasoning_effort === "string") payload.reasoning_effort = body.reasoning_effort;

  const veniceParams = (body.venice_parameters || {}) as Record<string, unknown>;
  const enableWebSearch = veniceParams.enable_web_search === true || veniceParams.enable_web_search === "on" || veniceParams.enable_web_search === "auto";
  const enableWebScraping = veniceParams.enable_web_scraping === true;

  if (enableWebSearch && payload.messages) {
    const messages = payload.messages as Array<{ role: string; content: string }>;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg?.content) {
      const query = typeof lastUserMsg.content === "string" ? lastUserMsg.content.slice(0, 200) : "";
      const results = await searchWeb(query).catch((error) => {
        console.error("API web search failed; continuing without search context:", error);
        return [];
      });
      if (results.length) {
        const ctx = buildSearchContext(results);
        const systemIdx = messages.findIndex((m) => m.role === "system");
        if (systemIdx >= 0) {
          messages[systemIdx] = {
            role: "system",
            content: `${String(messages[systemIdx].content)}\n\nUse the following web search results to inform your response:\n${ctx}`,
          };
        } else {
          messages.unshift({ role: "system", content: `Use the following web search results to inform your response:\n${ctx}` });
        }
        payload.messages = messages;
      }
    }
  }

  const inputTokensEstimated = estimateTokens((payload.messages as Array<{ content?: unknown }>).map((message) => messageText(message.content)).join("\n"));
  const shadowPricing = await estimateCatalogTextRequest(model.id, inputTokensEstimated, Number(payload.max_tokens)).catch(() => null);
  const shadowReservation = shadowPricing ? await createBillingReservation({
    workspaceId: auth.workspace.id,
    provider: shadowPricing.provider,
    model: model.id,
    modality: "TEXT",
    estimatedCostMicros: shadowPricing.estimatedCostMicros,
    pricingVersion: shadowPricing.pricingVersion,
    modeOverride: "shadow",
    metadata: { surface: "api", legacyCreditsCharged: model.credits, inputTokensEstimated, maxOutputTokens: payload.max_tokens as number },
  }).catch((error) => { console.error("API shadow billing reservation failed:", error); return null; }) : null;

  let upstream: Response | undefined;
  let lastError: unknown;
  for (const route of model.routes) {
    const key = providerApiKey(route.provider);
    const routeBaseUrl = route.baseUrl || (route.provider === "openrouter" ? BASE_URL : undefined);
    if (!key || !routeBaseUrl) continue;
    const upstreamStartedAt = Date.now();
    try {
      payload.model = route.providerModelId;
      const candidate = await fetch(`${routeBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: request.signal,
      });
      await recordModelRouteOutcome(route.id, candidate.ok, Date.now() - upstreamStartedAt, candidate.ok ? undefined : `HTTP ${candidate.status}`);
      upstream = candidate;
      if (candidate.ok && shadowReservation) await markBillingSent(shadowReservation.id).catch(() => undefined);
      const retryable = candidate.status === 408 || candidate.status === 429 || candidate.status >= 500;
      if (candidate.ok || !retryable) break;
      await candidate.body?.cancel().catch(() => undefined);
      upstream = undefined;
    } catch (error) {
      lastError = error;
      await recordModelRouteOutcome(route.id, false, Date.now() - upstreamStartedAt, error instanceof Error ? error.message : String(error));
    }
  }
  if (!upstream) {
    await refundCredits(auth.workspace.id, model.credits).catch((e) => console.error("refundCredits failed:", e));
    console.error("api chat upstream failed:", lastError || "No configured provider route");
    if (shadowReservation) await releaseBillingReservation(shadowReservation.id, true).catch(() => undefined);
    return Response.json({ error: { message: "Inference provider unavailable", type: "api_error", code: "upstream_unavailable" } }, { status: 502 });
  }

  if (!upstream.ok) {
    await refundCredits(auth.workspace.id, model.credits).catch((e) => console.error("refundCredits failed:", e));
    if (shadowReservation) await releaseBillingReservation(shadowReservation.id, true).catch(() => undefined);
  } else {
    await recordUsage(auth.workspace.id, "api", model.id, model.credits).catch((e) => console.error("recordUsage failed:", e));
  }

  const meteredUpstream = upstream.ok && shadowReservation
    ? await meterOpenAIResponse(upstream, shadowReservation.id, shadowPricing?.provider || model.route.provider, Boolean(payload.stream))
    : upstream;

  return new Response(meteredUpstream.body, {
    status: meteredUpstream.status,
    headers: {
      "Content-Type": meteredUpstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store, no-cache",
      ...(payload.stream ? { "X-Accel-Buffering": "no" } : {}),
    },
  });
}
