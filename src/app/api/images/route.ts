import { requireUser, emailVerifiedOrGuest } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage, acquireConcurrencySlot, reserveDailySpend, settleDailySpend, releaseDailySpend, getDailyImageCount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";
import { generateImageDetailed as generateImageOR, hasOpenRouter } from "@/lib/openrouter";
import { generateImageDetailed as generateImageFal, hasFal } from "@/lib/fal";
import { uploadImageFromDataUrl } from "@/lib/storage";
import { IMAGE_MODELS, IMAGE_STYLES, getPlanLimits } from "@/lib/models";
import { rateLimitShared } from "@/lib/rate-limit";
import { createBillingReservation, markBillingSent, releaseBillingReservation, requireBillingReconciliation, settleBillingReservation } from "@/lib/billing-engine";
import { usdToMicros } from "@/lib/unit-economics";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_RATE_LIMIT = 10;
const IMAGE_RATE_WINDOW = 60;
const ESTIMATED_IMAGE_COST_USD = 0.08;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().slice(0, 100);
    const favorites = url.searchParams.get("favorites") === "true";
    const images = await prisma.generatedImage.findMany({
      where: {
        workspaceId: ws.id,
        ...(favorites ? { favorite: true } : {}),
        ...(search ? { prompt: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return json({ images });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!emailVerifiedOrGuest(user)) return error("Email verification required", 403);

    const limits = getPlanLimits(ws.plan);
    const limitMicros = BigInt(Math.ceil(limits.dailySpendLimitUsd * 1_000_000));

    const rl = await rateLimitShared(`image:user:${ws.id}`, IMAGE_RATE_LIMIT, IMAGE_RATE_WINDOW);
    if (!rl.ok) return error("Rate limit exceeded.", 429);

    const dailyCount = await getDailyImageCount(ws.id);
    if (dailyCount >= limits.maxImagesPerDay) return error("Daily image limit reached.", 429);

    const slot = await acquireConcurrencySlot(ws.id, limits.maxConcurrency);
    if (slot === null) return error("Too many concurrent requests.", 429);

    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const styleId = String(body.style || "none");
    const modelId = String(body.model || IMAGE_MODELS[0].id);
    const inputImage = typeof body.inputImage === "string" && body.inputImage.startsWith("data:image/") ? body.inputImage : undefined;
    if (inputImage && inputImage.length > 16_000_000) return error("Base image must be smaller than 12 MB", 413);
    const aspectRatio = ["1:1", "4:5", "3:4", "16:9", "9:16", "4:3"].includes(body.aspectRatio) ? body.aspectRatio : "1:1";
    const quality = ["fast", "standard", "max"].includes(body.quality) ? body.quality : "standard";
    const quantity = Math.max(1, Math.min(4, Math.round(Number(body.quantity) || 1)));
    const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt.trim().slice(0, 2000) : "";
    const seed = Number.isFinite(Number(body.seed)) ? Math.round(Number(body.seed)) : undefined;
    const safeMode = body.safeMode !== false;
    if (!prompt) return error("Prompt required");

    const model = IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];
    if (inputImage && !model.supportsEditing) {
      return error("Selected model does not support image editing", 400);
    }
    if (dailyCount + quantity > limits.maxImagesPerDay) {
      return error(`Only ${Math.max(0, limits.maxImagesPerDay - dailyCount)} image generations remain today.`, 429);
    }
    const unitCost = inputImage ? model.credits + 1 : model.credits;
    const cost = unitCost * quantity;
    if (ws.credits < cost) {
      return error("Insufficient credits", 402);
    }

    const style = IMAGE_STYLES.find((s) => s.id === styleId);
    const fullPrompt = style?.prompt ? `${prompt}, ${style.prompt}` : prompt;

    if (!hasOpenRouter() && !hasFal()) {
      return error("No inference backend configured", 503);
    }

    const estMicros = BigInt(Math.ceil(ESTIMATED_IMAGE_COST_USD * quantity * 1_000_000));
    const spendOk = await reserveDailySpend(ws.id, estMicros, limitMicros);
    if (!spendOk) return error("Daily spending limit reached.", 402);

    const kind = inputImage ? "image-edit" : "image";
    if (!(await reserveCredits(ws.id, cost))) {
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      return error("Insufficient credits", 402);
    }
    const shadowReservation = await createBillingReservation({
      workspaceId: ws.id,
      provider: model.provider || "openrouter",
      model: model.id,
      modality: "IMAGE",
      estimatedCostMicros: estMicros,
      pricingVersion: `image-shadow:${model.id}:2026-07-24`,
      modeOverride: "shadow",
      metadata: { surface: "app", legacyCreditsCharged: cost, estimateSource: "temporary-cap" },
    }).catch((billingError) => { console.error("image shadow billing reservation failed:", billingError); return null; });
    try {
      if (shadowReservation) await markBillingSent(shadowReservation.id).catch(() => undefined);
      const generated = await Promise.all(Array.from({ length: quantity }, (_, index) => {
        const options = { aspectRatio, quality, negativePrompt, seed: seed === undefined ? undefined : seed + index, safeMode };
        return model.provider === "fal"
          ? generateImageFal(model.id, fullPrompt, undefined, options)
          : generateImageOR(model.id, fullPrompt, inputImage, options);
      }));
      const urls = await Promise.all(generated.map((item) => uploadImageFromDataUrl(item.url)));
      const images = await prisma.$transaction(urls.map((url, index) => prisma.generatedImage.create({
        data: {
          workspaceId: ws.id, prompt, model: model.id, style: styleId, url,
          width: generated[index].width || 1024, height: generated[index].height || 1024,
          aspectRatio, quality, negativePrompt: negativePrompt || null,
          seed: seed === undefined ? null : seed + index,
        },
      })));
      const reportedCosts = generated.map((item) => item.costUsd);
      const totalCostUsd = reportedCosts.every((value) => value !== undefined)
        ? reportedCosts.reduce<number>((sum, value) => sum + (value || 0), 0)
        : undefined;
      const actualCostMicros = totalCostUsd === undefined ? undefined : usdToMicros(totalCostUsd);
      const generationId = generated.map((item) => item.providerRequestId).filter(Boolean).join(",") || undefined;
      await recordUsage(ws.id, kind, model.id, cost, { cost: totalCostUsd, generationId }).catch(() => {});
      if (actualCostMicros === undefined) {
        if (shadowReservation) await requireBillingReconciliation(shadowReservation.id, generationId).catch(() => undefined);
        settleDailySpend(ws.id, estMicros, estMicros).catch(() => {});
      } else {
        if (shadowReservation) await settleBillingReservation(shadowReservation.id, {
          providerRequestId: generationId,
          providerCostMicros: actualCostMicros,
          providerFeeMicros: model.provider === "openrouter" ? (actualCostMicros * 55n + 999n) / 1000n : 0n,
          imageMegapixels: generated.reduce((sum, item) => sum + (item.megapixels || 0), 0) || undefined,
          imageCount: quantity,
        }).catch(() => undefined);
        settleDailySpend(ws.id, estMicros, actualCostMicros).catch(() => {});
      }
      return json({ image: images[0], images, creditsCharged: cost });
    } catch (e) {
      await refundCredits(ws.id, cost).catch(() => {});
      if (shadowReservation) await releaseBillingReservation(shadowReservation.id, true).catch(() => undefined);
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
