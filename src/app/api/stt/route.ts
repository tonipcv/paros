import { requireUser, emailVerifiedOrGuest } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage, reserveDailySpend, releaseDailySpend, settleDailySpend } from "@/lib/account";
import { error, json, handleRouteError } from "@/lib/http";
import { hasOpenAI, speechToText, audioDurationSeconds } from "@/lib/openai-audio";
import { CREDITS, getPlanLimits } from "@/lib/models";
import { createUnpricedShadowReservation, markBillingSent, releaseBillingReservation, requireBillingReconciliation } from "@/lib/billing-engine";
import { creditsForCost } from "@/lib/unit-economics";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 15 * 60;
// whisper-1: $0.006 per minute = 100 micros per second
const WHISPER_MICROS_PER_SECOND = 100n;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!emailVerifiedOrGuest(user)) return error("Email verification required", 403);
    if (!hasOpenAI()) return error("Voice is not configured (OPENAI_API_KEY missing)", 503);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return error("Audio file required");
    if (file.size < 1 || file.size > MAX_AUDIO_BYTES) return error(`Audio file must be between 1 byte and ${MAX_AUDIO_BYTES / (1024 * 1024)} MB`, 413);

    const seconds = await audioDurationSeconds(file);
    if (seconds === null) return error("Could not determine audio duration", 422);
    if (seconds > MAX_AUDIO_SECONDS) return error(`Audio is too long. Maximum ${Math.floor(MAX_AUDIO_SECONDS / 60)} minutes.`, 413);

    const estimatedMicros = BigInt(Math.trunc(seconds)) * WHISPER_MICROS_PER_SECOND;
    const credits = Math.max(CREDITS.stt, creditsForCost(estimatedMicros));
    const limitMicros = BigInt(Math.ceil(getPlanLimits(ws.plan).dailySpendLimitUsd * 1_000_000));
    if (!(await reserveDailySpend(ws.id, estimatedMicros, limitMicros))) return error("Daily spending limit reached.", 402);
    if (!(await reserveCredits(ws.id, credits))) { await releaseDailySpend(ws.id, estimatedMicros).catch(() => undefined); return error("Insufficient credits", 402); }
    const shadow = await createUnpricedShadowReservation({ workspaceId: ws.id, provider: "openai", model: "whisper-1", modality: "ASR", estimatedCostMicros: estimatedMicros, surface: "app", legacyCreditsCharged: credits }).catch(() => null);
    try {
      if (shadow) await markBillingSent(shadow.id).catch(() => undefined);
      const text = await speechToText(file);
      if (shadow) await requireBillingReconciliation(shadow.id).catch(() => undefined);
      await settleDailySpend(ws.id, estimatedMicros, estimatedMicros).catch((e) => console.error("settleDailySpend failed:", e));
      await recordUsage(ws.id, "stt", "whisper-1", credits).catch((e) => console.error("recordUsage failed:", e));
      return json({ text });
    } catch (e) {
      await refundCredits(ws.id, credits).catch((refundErr) => console.error("refundCredits failed:", refundErr));
      if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
      await releaseDailySpend(ws.id, estimatedMicros).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
