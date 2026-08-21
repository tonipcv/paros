import type { ArtifactKind, ModelModality, Prisma } from "@prisma/client";
import { recordUsage, refundCredits, reserveCredits } from "./account";
import { submitFalJob } from "./fal-queue";
import { resolveCatalogModel } from "./model-catalog";
import { prisma } from "./prisma";
import { createUnpricedShadowReservation, markBillingSent, releaseBillingReservation, requireBillingReconciliation, settleBillingReservation } from "./billing-engine";
import { usdToMicros } from "./unit-economics";
import { falVideoCostUsd, topazImageCostUsd } from "./provider-pricing";

const OPERATION_MODALITY: Record<string, ModelModality> = {
  "text-to-video": "VIDEO", "image-to-video": "VIDEO", "video-edit": "VIDEO",
  music: "MUSIC", upscale: "UPSCALE", inpaint: "INPAINT", "image-edit": "INPAINT",
};

export function modalityForOperation(operation: string) { return OPERATION_MODALITY[operation]; }

function safeUrl(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`${field} is required`);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${field} must be a valid public HTTPS URL`); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error(`${field} must be a public HTTPS URL`);
  return value;
}

export function sanitizeGenerationInput(operation: string, input: Record<string, unknown>) {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 8000) : "";
  const optionalString = (key: string, max = 200) => typeof input[key] === "string" ? String(input[key]).slice(0, max) : undefined;
  if (["text-to-video", "image-to-video", "video-edit", "music", "inpaint", "image-edit"].includes(operation) && !prompt) throw new Error("prompt is required");
  if (operation === "text-to-video") return { prompt, negative_prompt: optionalString("negative_prompt", 2000), duration: typeof input.duration === "number" ? Math.max(1, Math.min(15, Math.round(input.duration))) : undefined, aspect_ratio: optionalString("aspect_ratio"), resolution: optionalString("resolution"), generate_audio: input.generate_audio === true };
  if (operation === "image-to-video") return { prompt, image_url: safeUrl(input.image_url, "image_url"), duration: typeof input.duration === "number" ? Math.max(1, Math.min(15, Math.round(input.duration))) : undefined, aspect_ratio: optionalString("aspect_ratio"), resolution: optionalString("resolution") };
  if (operation === "video-edit") return { prompt, video_url: safeUrl(input.video_url, "video_url") };
  if (operation === "music") return { prompt, duration: typeof input.duration === "number" ? Math.max(1, Math.min(180, Math.round(input.duration))) : undefined, seconds_total: typeof input.seconds_total === "number" ? Math.max(1, Math.min(180, Math.round(input.seconds_total))) : undefined };
  if (operation === "upscale") return { image_url: safeUrl(input.image_url, "image_url"), upscale_factor: typeof input.upscale_factor === "number" ? Math.max(1, Math.min(4, input.upscale_factor)) : 2, output_format: input.output_format === "png" ? "png" : "jpeg", model: optionalString("model", 50) };
  if (operation === "inpaint" || operation === "image-edit") return { prompt, image_url: safeUrl(input.image_url, "image_url"), mask_url: safeUrl(input.mask_url, "mask_url"), negative_prompt: optionalString("negative_prompt", 2000), num_inference_steps: typeof input.num_inference_steps === "number" ? Math.max(1, Math.min(100, Math.round(input.num_inference_steps))) : undefined, seed: typeof input.seed === "number" ? Math.round(input.seed) : undefined, model_name: optionalString("model_name", 300) };
  throw new Error("Unsupported generation operation");
}

export async function createGenerationJob(args: {
  workspaceId: string; modelId: string; operation: string; input: Record<string, unknown>; idempotencyKey?: string; baseUrl: string;
}) {
  const modality = modalityForOperation(args.operation);
  if (!modality) throw new Error("Unsupported generation operation");
  const sanitizedInput = Object.fromEntries(Object.entries(sanitizeGenerationInput(args.operation, args.input)).filter(([, value]) => value !== undefined));
  if (args.idempotencyKey) {
    const existing = await prisma.generationJob.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId: args.workspaceId, idempotencyKey: args.idempotencyKey } }, include: { artifacts: true } });
    if (existing) return existing;
  }
  const model = await resolveCatalogModel(args.modelId, modality);
  if (!model) throw new Error("Model not found for this operation");
  const route = model.routes.find((candidate) => candidate.provider === "fal");
  if (!route) throw new Error("No asynchronous fal route is configured for this model");
  if (!(await reserveCredits(args.workspaceId, model.credits))) throw new Error("Insufficient credits");
  const shadow = await createUnpricedShadowReservation({
    workspaceId: args.workspaceId, provider: route.provider, model: model.id, modality,
    estimatedCostMicros: BigInt(model.credits) * 15_000n, surface: "api-async", legacyCreditsCharged: model.credits,
  }).catch((error) => { console.error("async shadow billing reservation failed:", error); return null; });
  let job;
  try {
    job = await prisma.generationJob.create({
      data: {
        workspaceId: args.workspaceId, publicModelId: model.id, provider: route.provider,
        providerModelId: route.providerModelId, modality, operation: args.operation,
        input: sanitizedInput as Prisma.InputJsonValue, idempotencyKey: args.idempotencyKey, creditsReserved: model.credits,
        billingLedgerId: shadow?.id,
      },
    });
  } catch (error) {
    await refundCredits(args.workspaceId, model.credits).catch(() => undefined);
    if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
    if (args.idempotencyKey) {
      const existing = await prisma.generationJob.findUnique({ where: { workspaceId_idempotencyKey: { workspaceId: args.workspaceId, idempotencyKey: args.idempotencyKey } }, include: { artifacts: true } });
      if (existing) return existing;
    }
    throw error;
  }
  try {
    const submitted = await submitFalJob(route.providerModelId, sanitizedInput, `${args.baseUrl.replace(/\/$/, "")}/api/webhooks/fal`);
    if (shadow) await markBillingSent(shadow.id, submitted.requestId).catch(() => undefined);
    return prisma.generationJob.update({
      where: { id: job.id },
      data: { providerRequestId: submitted.requestId, status: "QUEUED", attempts: 1, output: { statusUrl: submitted.statusUrl, responseUrl: submitted.responseUrl, cancelUrl: submitted.cancelUrl } },
      include: { artifacts: true },
    });
  } catch (error) {
    await refundCredits(args.workspaceId, model.credits).catch(() => undefined);
    if (shadow) await releaseBillingReservation(shadow.id, true).catch(() => undefined);
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : String(error), completedAt: new Date() } });
    throw error;
  }
}

function artifactCandidates(payload: Record<string, unknown>, audioKind: ArtifactKind = "AUDIO") {
  const output: Array<{ url: string; kind: ArtifactKind; contentType: string; width?: number; height?: number; durationMs?: number }> = [];
  const add = (value: unknown, kind: ArtifactKind) => {
    if (typeof value === "string" && /^https:\/\//.test(value)) output.push({ url: value, kind, contentType: kind === "VIDEO" ? "video/mp4" : kind === "IMAGE" ? "image/png" : "audio/mpeg" });
    else if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      if (typeof item.url === "string") output.push({ url: item.url, kind, contentType: typeof item.content_type === "string" ? item.content_type : kind === "VIDEO" ? "video/mp4" : kind === "IMAGE" ? "image/png" : "audio/mpeg", width: typeof item.width === "number" ? item.width : undefined, height: typeof item.height === "number" ? item.height : undefined, durationMs: typeof item.duration === "number" ? Math.round(item.duration * 1000) : undefined });
    }
  };
  if (Array.isArray(payload.images)) for (const image of payload.images) add(image, "IMAGE");
  add(payload.image, "IMAGE"); add(payload.video, "VIDEO"); add(payload.audio, audioKind); add(payload.audio_url, audioKind); add(payload.audio_file, audioKind); add(payload.music, "MUSIC");
  return output;
}

export async function completeFalJob(requestId: string, status: string, payload: Record<string, unknown>, error?: string) {
  const job = await prisma.generationJob.findUnique({ where: { provider_providerRequestId: { provider: "fal", providerRequestId: requestId } } });
  if (!job) return null;
  // CANCEL_REQUESTED is terminal for completion: a client refund is already in
  // flight and delivering an artifact here would hand the user a refund plus a
  // finished job. The cancel flow finalizes the row as CANCELED.
  if (["SUCCEEDED", "FAILED", "CANCELED", "CANCEL_REQUESTED"].includes(job.status)) return job;
  if (status !== "OK") {
    await refundCredits(job.workspaceId, job.creditsReserved).catch(() => undefined);
    if (job.billingLedgerId) await releaseBillingReservation(job.billingLedgerId, true).catch(() => undefined);
    return prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", error: (error || "fal generation failed").slice(0, 2000), completedAt: new Date(), progress: 100 } });
  }
  const artifacts = artifactCandidates(payload, job.modality === "MUSIC" ? "MUSIC" : "AUDIO");
  const usage = payload.usage && typeof payload.usage === "object" ? payload.usage as Record<string, unknown> : undefined;
  const reportedCostUsd = typeof payload.cost === "number" ? payload.cost : typeof usage?.cost === "number" ? usage.cost : undefined;
  const costUsd = reportedCostUsd ?? knownFalJobCostUsd(job.providerModelId, job.input, payload, artifacts);
  const actualCostMicros = costUsd === undefined ? 0n : usdToMicros(costUsd);
  const completed = await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: "SUCCEEDED", progress: 100, output: payload as Prisma.InputJsonValue, completedAt: new Date(), actualCostMicros,
      artifacts: { create: artifacts.map((artifact) => ({ workspaceId: job.workspaceId, ...artifact, metadata: { persistence: "provider-temporary" }, expiresAt: new Date(Date.now() + 55 * 60 * 1000) })) },
    },
    include: { artifacts: true },
  });
  if (job.billingLedgerId) {
    if (costUsd === undefined) {
      await requireBillingReconciliation(job.billingLedgerId, requestId).catch(() => undefined);
    } else {
      await settleBillingReservation(job.billingLedgerId, {
        providerRequestId: requestId,
        providerCostMicros: actualCostMicros,
        videoSeconds: typeof sanitizedDuration(payload) === "number" ? sanitizedDuration(payload) : undefined,
      }).catch(() => undefined);
    }
  }
  await recordUsage(job.workspaceId, `api-${job.operation}`, job.publicModelId, job.creditsReserved, { generationId: requestId }).catch(() => undefined);
  return completed;
}

function knownFalJobCostUsd(
  model: string,
  rawInput: Prisma.JsonValue,
  payload: Record<string, unknown>,
  artifacts: Array<{ width?: number; height?: number }>,
) {
  const input = rawInput && typeof rawInput === "object" && !Array.isArray(rawInput) ? rawInput as Record<string, unknown> : {};
  if (model === "fal-ai/stable-audio-25/text-to-audio") return 0.20;
  if (["fal-ai/vidu/q3/text-to-video", "fal-ai/wan/v2.7/text-to-video"].includes(model)) {
    const duration = sanitizedDuration(payload) ?? (typeof input.duration === "number" ? input.duration : 5);
    const resolution = typeof input.resolution === "string" ? input.resolution : model.includes("vidu") ? "720p" : "1080p";
    return falVideoCostUsd(model, duration, resolution);
  }
  if (model === "fal-ai/topaz/upscale/image") {
    const image = artifacts.find((artifact) => artifact.width && artifact.height);
    if (image?.width && image.height) return topazImageCostUsd(image.width * image.height / 1_000_000);
  }
  return undefined;
}

function sanitizedDuration(payload: Record<string, unknown>) {
  if (typeof payload.duration === "number") return Math.max(0, payload.duration);
  const video = payload.video && typeof payload.video === "object" ? payload.video as Record<string, unknown> : undefined;
  const audio = payload.audio && typeof payload.audio === "object" ? payload.audio as Record<string, unknown> : undefined;
  return typeof video?.duration === "number" ? video.duration : typeof audio?.duration === "number" ? audio.duration : undefined;
}
