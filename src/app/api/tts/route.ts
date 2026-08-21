import { requireUser, emailVerifiedOrGuest } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { error, handleRouteError } from "@/lib/http";
import { hasOpenAI, textToSpeech } from "@/lib/openai-audio";
import { CREDITS } from "@/lib/models";
import { createBillingReservation, markBillingSent, releaseBillingReservation, settleBillingReservation } from "@/lib/billing-engine";
import { PRICING_RESEARCHED_AT, tts1CostMicros } from "@/lib/provider-pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!emailVerifiedOrGuest(user)) return error("Email verification required", 403);
    if (!hasOpenAI()) return error("Voice is not configured (OPENAI_API_KEY missing)", 503);

    const body = await request.json();
    const text = String(body.text || "").trim();
    const voice = String(body.voice || "alloy");
    if (!text) return error("Text required");

    if (!(await reserveCredits(ws.id, CREDITS.tts))) return error("Insufficient credits", 402);
    const providerCostMicros = tts1CostMicros(text.length);
    const shadow = await createBillingReservation({ workspaceId: ws.id, provider: "openai", model: "tts-1", modality: "TTS", estimatedCostMicros: providerCostMicros, pricingVersion: `openai-official-${PRICING_RESEARCHED_AT}`, modeOverride: "shadow", metadata: { surface: "app", legacyCreditsCharged: CREDITS.tts, characters: Math.min(text.length, 4000) } }).catch(() => null);
    try {
      if (shadow) await markBillingSent(shadow.id).catch(() => undefined);
      const audio = await textToSpeech(text, voice);
      if (shadow) await settleBillingReservation(shadow.id, { providerCostMicros }).catch(() => undefined);
      await recordUsage(ws.id, "tts", "tts-1", CREDITS.tts).catch((e) => console.error("recordUsage failed:", e));
      return new Response(audio, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
      });
    } catch (e) {
      await refundCredits(ws.id, CREDITS.tts).catch((refundErr) => console.error("refundCredits failed:", refundErr));
      if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
