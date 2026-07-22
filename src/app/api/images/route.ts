import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage, acquireConcurrencySlot, reserveDailySpend, settleDailySpend, releaseDailySpend, getDailyImageCount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";
import { generateImage as generateImageOR, hasOpenRouter } from "@/lib/openrouter";
import { generateImage as generateImageFal, hasFal } from "@/lib/fal";
import { uploadImageFromDataUrl } from "@/lib/storage";
import { IMAGE_MODELS, IMAGE_STYLES, getPlanLimits } from "@/lib/models";
import { rateLimitShared } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_RATE_LIMIT = 10;
const IMAGE_RATE_WINDOW = 60;
const ESTIMATED_IMAGE_COST_USD = 0.08;

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    const images = await prisma.generatedImage.findMany({
      where: { workspaceId: ws.id },
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

    const limits = getPlanLimits(ws.plan);
    const estMicros = BigInt(Math.ceil(ESTIMATED_IMAGE_COST_USD * 1_000_000));
    const limitMicros = BigInt(Math.ceil(limits.dailySpendLimitUsd * 1_000_000));

    const rl = await rateLimitShared(`image:user:${ws.id}`, IMAGE_RATE_LIMIT, IMAGE_RATE_WINDOW);
    if (!rl.ok) return error("Rate limit exceeded.", 429);

    const dailyCount = await getDailyImageCount(ws.id);
    if (dailyCount >= limits.maxImagesPerDay) return error("Daily image limit reached.", 429);

    const slot = await acquireConcurrencySlot(ws.id, limits.maxConcurrency);
    if (slot === null) return error("Too many concurrent requests.", 429);

    const spendOk = await reserveDailySpend(ws.id, estMicros, limitMicros);
    if (!spendOk) return error("Daily spending limit reached.", 402);

    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const styleId = String(body.style || "none");
    const modelId = String(body.model || IMAGE_MODELS[0].id);
    const inputImage = typeof body.inputImage === "string" && body.inputImage.startsWith("data:") ? body.inputImage : undefined;
    if (!prompt) {
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      return error("Prompt required");
    }

    const model = IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];
    const cost = inputImage ? model.credits + 1 : model.credits;
    if (ws.credits < cost) {
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      return error("Insufficient credits", 402);
    }

    const style = IMAGE_STYLES.find((s) => s.id === styleId);
    const fullPrompt = style?.prompt ? `${prompt}, ${style.prompt}` : prompt;

    if (!hasOpenRouter() && !hasFal()) {
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      return error("No inference backend configured", 503);
    }

    const kind = inputImage ? "image-edit" : "image";
    if (!(await reserveCredits(ws.id, cost))) {
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      return error("Insufficient credits", 402);
    }
    try {
      const rawUrl = model.provider === "fal"
        ? await generateImageFal(model.id, fullPrompt)
        : await generateImageOR(model.id, fullPrompt, inputImage);
      const url = await uploadImageFromDataUrl(rawUrl);
      await prisma.generatedImage.create({
        data: { workspaceId: ws.id, prompt, model: model.id, style: styleId, url },
      });
      await recordUsage(ws.id, kind, model.id, cost).catch(() => {});
      settleDailySpend(ws.id, estMicros, 0n).catch(() => {});
      return json({ image: { url, model: model.id } });
    } catch (e) {
      await refundCredits(ws.id, cost).catch(() => {});
      releaseDailySpend(ws.id, estMicros).catch(() => {});
      throw e;
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
