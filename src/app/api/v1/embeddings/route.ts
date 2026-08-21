import { authenticateApiKey } from "@/lib/api-auth";
import { recordUsage, refundCredits, reserveCredits } from "@/lib/account";
import { recordModelRouteOutcome, resolveCatalogModel } from "@/lib/model-catalog";
import { providerApiKey } from "@/lib/provider-credentials";
import { estimateTokens } from "@/lib/account";
import { estimateCatalogInputRequest } from "@/lib/billing-pricing";
import { createBillingReservation, markBillingSent, releaseBillingReservation } from "@/lib/billing-engine";
import { meterOpenAIResponse } from "@/lib/metered-provider-response";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 1024 * 1024;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: { message: auth.message } }, { status: auth.status });
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: { message: "Request body too large" } }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: { message: "Invalid JSON body" } }, { status: 400 }); }
  const modelId = typeof body.model === "string" ? body.model : "";
  if (typeof body.input !== "string" && !Array.isArray(body.input)) return Response.json({ error: { message: "input is required", param: "input" } }, { status: 400 });
  const model = await resolveCatalogModel(modelId, "EMBEDDING");
  if (!model) return Response.json({ error: { message: `Embedding model '${modelId || "(missing)"}' does not exist`, code: "model_not_found" } }, { status: 404 });
  if (!(await reserveCredits(auth.workspace.id, model.credits))) return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });

  const inputText = typeof body.input === "string" ? body.input : (body.input as unknown[]).map((item) => typeof item === "string" ? item : "").join("\n");
  const inputTokensEstimated = estimateTokens(inputText);
  const shadowPricing = await estimateCatalogInputRequest(model.id, inputTokensEstimated).catch(() => null);
  const shadowReservation = shadowPricing ? await createBillingReservation({
    workspaceId: auth.workspace.id, provider: shadowPricing.provider, model: model.id, modality: "EMBEDDING",
    estimatedCostMicros: shadowPricing.estimatedCostMicros, pricingVersion: shadowPricing.pricingVersion,
    modeOverride: "shadow", metadata: { surface: "api", legacyCreditsCharged: model.credits, inputTokensEstimated },
  }).catch((error) => { console.error("embedding shadow billing reservation failed:", error); return null; }) : null;

  const payload: Record<string, unknown> = { input: body.input, model: model.route.providerModelId };
  if (typeof body.dimensions === "number" && Number.isInteger(body.dimensions) && body.dimensions > 0) payload.dimensions = body.dimensions;
  if (body.encoding_format === "float" || body.encoding_format === "base64") payload.encoding_format = body.encoding_format;
  if (typeof body.input_type === "string") payload.input_type = body.input_type;
  let upstream: Response | undefined;
  for (const route of model.routes) {
    const key = providerApiKey(route.provider);
    const baseUrl = route.baseUrl || (route.provider === "openrouter" ? OPENROUTER_BASE_URL : undefined);
    if (!key || !baseUrl) continue;
    const startedAt = Date.now();
    try {
      payload.model = route.providerModelId;
      const candidate = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: request.signal,
      });
      await recordModelRouteOutcome(route.id, candidate.ok, Date.now() - startedAt, candidate.ok ? undefined : `HTTP ${candidate.status}`);
      upstream = candidate;
      if (candidate.ok && shadowReservation) await markBillingSent(shadowReservation.id).catch(() => undefined);
      if (candidate.ok || (candidate.status < 500 && candidate.status !== 429)) break;
      await candidate.body?.cancel().catch(() => undefined);
      upstream = undefined;
    } catch (error) {
      await recordModelRouteOutcome(route.id, false, Date.now() - startedAt, error instanceof Error ? error.message : String(error));
    }
  }
  if (!upstream) {
    await refundCredits(auth.workspace.id, model.credits).catch(() => undefined);
    if (shadowReservation) await releaseBillingReservation(shadowReservation.id, true).catch(() => undefined);
    return Response.json({ error: { message: "Embedding provider unavailable" } }, { status: 502 });
  }
  if (!upstream.ok) {
    await refundCredits(auth.workspace.id, model.credits).catch(() => undefined);
    if (shadowReservation) await releaseBillingReservation(shadowReservation.id, true).catch(() => undefined);
  }
  else await recordUsage(auth.workspace.id, "api-embedding", model.id, model.credits).catch((error) => console.error("recordUsage failed:", error));
  const metered = upstream.ok && shadowReservation ? await meterOpenAIResponse(upstream, shadowReservation.id, shadowPricing?.provider || model.route.provider, false) : upstream;
  return new Response(metered.body, { status: metered.status, headers: { "Content-Type": metered.headers.get("content-type") || "application/json", "Cache-Control": "no-store" } });
}
