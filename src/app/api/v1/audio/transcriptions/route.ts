import { authenticateApiKey } from "@/lib/api-auth";
import { recordUsage, refundCredits, reserveCredits } from "@/lib/account";
import { recordModelRouteOutcome, resolveCatalogModel } from "@/lib/model-catalog";
import { providerApiKey } from "@/lib/provider-credentials";
import { createUnpricedShadowReservation, markBillingSent, releaseBillingReservation, requireBillingReconciliation } from "@/lib/billing-engine";
import { audioDurationSeconds } from "@/lib/openai-audio";
import { estimateAudioCostMicros } from "@/lib/billing-pricing";
import { creditsToReserve } from "@/lib/unit-economics";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 15 * 60;
const ALLOWED_FORMATS = new Set(["audio/flac", "audio/mpeg", "audio/mp4", "audio/mpga", "audio/m4a", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm", "video/mp4"]);

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return Response.json({ error: { message: auth.message } }, { status: auth.status });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES + 1024 * 1024) return Response.json({ error: { message: "Audio file is too large" } }, { status: 413 });
  let incoming: FormData;
  try { incoming = await request.formData(); } catch { return Response.json({ error: { message: "Invalid multipart form data" } }, { status: 400 }); }
  const file = incoming.get("file");
  if (!(file instanceof File)) return Response.json({ error: { message: "file is required", param: "file" } }, { status: 400 });
  if (file.size < 1 || file.size > MAX_AUDIO_BYTES) return Response.json({ error: { message: "Audio file must contain between 1 byte and 25 MB", param: "file" } }, { status: 400 });
  if (file.type && !ALLOWED_FORMATS.has(file.type)) return Response.json({ error: { message: "Unsupported audio format", param: "file" } }, { status: 415 });
  const modelId = String(incoming.get("model") || "openai/gpt-4o-mini-transcribe");
  const model = await resolveCatalogModel(modelId, "ASR");
  if (!model) return Response.json({ error: { message: `Transcription model '${modelId}' does not exist`, code: "model_not_found" } }, { status: 404 });

  const seconds = await audioDurationSeconds(file);
  if (seconds === null) return Response.json({ error: { message: "Could not determine audio duration", param: "file" } }, { status: 422 });
  if (seconds > MAX_AUDIO_SECONDS) return Response.json({ error: { message: `Audio is too long. Maximum ${Math.floor(MAX_AUDIO_SECONDS / 60)} minutes.`, param: "file" } }, { status: 413 });

  const estimatedMicros = await estimateAudioCostMicros(model.id, seconds);
  const credits = Math.max(model.credits, creditsToReserve(estimatedMicros));
  if (!(await reserveCredits(auth.workspace.id, credits))) return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  const shadow = await createUnpricedShadowReservation({
    workspaceId: auth.workspace.id, provider: model.route.provider, model: model.id, modality: "ASR",
    estimatedCostMicros: estimatedMicros, surface: "api", legacyCreditsCharged: credits,
  }).catch(() => null);

  let upstream: Response | undefined;
  for (const route of model.routes) {
    const key = providerApiKey(route.provider);
    if (!key || !route.baseUrl) continue;
    const form = new FormData();
    form.append("file", file, file.name || "audio.webm");
    form.append("model", route.providerModelId);
    for (const field of ["language", "prompt", "response_format", "temperature", "chunking_strategy"] as const) {
      const value = incoming.get(field);
      if (typeof value === "string" && value) form.append(field, value);
    }
    for (const value of incoming.getAll("timestamp_granularities[]")) if (typeof value === "string") form.append("timestamp_granularities[]", value);
    const startedAt = Date.now();
    try {
      const candidate = await fetch(`${route.baseUrl.replace(/\/$/, "")}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: request.signal });
      await recordModelRouteOutcome(route.id, candidate.ok, Date.now() - startedAt, candidate.ok ? undefined : `HTTP ${candidate.status}`);
      upstream = candidate;
      if (candidate.ok && shadow) await markBillingSent(shadow.id).catch(() => undefined);
      if (candidate.ok || (candidate.status < 500 && candidate.status !== 429)) break;
      await candidate.body?.cancel().catch(() => undefined);
      upstream = undefined;
    } catch (error) {
      await recordModelRouteOutcome(route.id, false, Date.now() - startedAt, error instanceof Error ? error.message : String(error));
    }
  }
  if (!upstream) {
    await refundCredits(auth.workspace.id, credits).catch(() => undefined);
    if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
    return Response.json({ error: { message: "Transcription provider unavailable" } }, { status: 502 });
  }
  if (!upstream.ok) {
    await refundCredits(auth.workspace.id, credits).catch(() => undefined);
    if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
  } else {
    if (shadow) await requireBillingReconciliation(shadow.id, upstream.headers.get("x-request-id") || undefined).catch(() => undefined);
    await recordUsage(auth.workspace.id, "api-transcription", model.id, credits).catch((error) => console.error("recordUsage failed:", error));
  }
  return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store" } });
}
