import { authenticateApiKey } from "@/lib/api-auth";
import { recordUsage, refundCredits, reserveCredits } from "@/lib/account";
import { CREDITS } from "@/lib/models";
import { hasOpenAI, textToSpeech } from "@/lib/openai-audio";
import { createBillingReservation, markBillingSent, releaseBillingReservation, settleBillingReservation } from "@/lib/billing-engine";
import { PRICING_RESEARCHED_AT, tts1CostMicros } from "@/lib/provider-pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: { message: auth.message, type: "authentication_error", code: "invalid_api_key" } },
      { status: auth.status, headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {} }
    );
  }
  if (!hasOpenAI()) return Response.json({ error: { message: "Audio backend not configured" } }, { status: 503 });

  const body = await request.json().catch(() => null) as { input?: unknown; voice?: unknown } | null;
  if (!body) return Response.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const voice = typeof body.voice === "string" ? body.voice : "alloy";
  if (!input) return Response.json({ error: { message: "input is required", param: "input" } }, { status: 400 });
  if (input.length > 4000) return Response.json({ error: { message: "input must contain at most 4000 characters", param: "input" } }, { status: 400 });
  if (!VOICES.has(voice)) return Response.json({ error: { message: "Unsupported voice", param: "voice" } }, { status: 400 });
  if (!(await reserveCredits(auth.workspace.id, CREDITS.tts))) return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  const providerCostMicros = tts1CostMicros(input.length);
  const shadow = await createBillingReservation({ workspaceId: auth.workspace.id, provider: "openai", model: "tts-1", modality: "TTS", estimatedCostMicros: providerCostMicros, pricingVersion: `openai-official-${PRICING_RESEARCHED_AT}`, modeOverride: "shadow", metadata: { surface: "api", legacyCreditsCharged: CREDITS.tts, characters: input.length } }).catch(() => null);

  try {
    if (shadow) await markBillingSent(shadow.id).catch(() => undefined);
    const audio = await textToSpeech(input, voice);
    if (shadow) await settleBillingReservation(shadow.id, { providerCostMicros }).catch(() => undefined);
    await recordUsage(auth.workspace.id, "api-tts", "tts-1", CREDITS.tts).catch((e) => console.error("recordUsage failed:", e));
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch (error) {
    await refundCredits(auth.workspace.id, CREDITS.tts).catch((e) => console.error("refundCredits failed:", e));
    if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
    console.error("api speech generation failed:", error);
    return Response.json({ error: { message: "Audio generation failed" } }, { status: 502 });
  }
}
