import { chargeCredits } from "@/lib/account";
import { hasOpenRouter } from "@/lib/openrouter";
import { findChatModel } from "@/lib/models";
import { authenticateApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";

const BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const MAX_OUTPUT_TOKENS = 8192;
const MAX_BODY_BYTES = 256 * 1024;

function clamp(n: unknown, min: number, max: number): number | undefined {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined;
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: { message: auth.message } },
      { status: auth.status, headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {} }
    );
  }
  if (!hasOpenRouter()) {
    return Response.json({ error: { message: "Inference backend not configured" } }, { status: 503 });
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

  const model = findChatModel(typeof body.model === "string" ? body.model : "");
  if (auth.workspace.credits < model.credits) {
    return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  }

  // Allowlist forwarded params — never proxy arbitrary fields — and cap output
  // tokens so a single flat-priced request can't run up unbounded cost.
  const requested = clamp(body.max_tokens, 1, MAX_OUTPUT_TOKENS);
  const payload: Record<string, unknown> = {
    model: model.id,
    messages: body.messages,
    max_tokens: requested ?? MAX_OUTPUT_TOKENS,
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

  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (upstream.ok) {
    await chargeCredits(auth.workspace.id, "api", model.id, model.credits).catch((e) => console.error("chargeCredits failed:", e));
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
