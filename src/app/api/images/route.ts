import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser, reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json, handleRouteError } from "@/lib/http";
import { generateImage, hasOpenRouter } from "@/lib/openrouter";
import { uploadImageFromDataUrl } from "@/lib/storage";
import { IMAGE_MODELS, IMAGE_STYLES } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const styleId = String(body.style || "none");
    const modelId = String(body.model || IMAGE_MODELS[0].id);
    const inputImage = typeof body.inputImage === "string" && body.inputImage.startsWith("data:") ? body.inputImage : undefined;
    if (!prompt) return error("Prompt required");

    const model = IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];
    const cost = inputImage ? model.credits + 1 : model.credits;
    if (ws.credits < cost) return error("Insufficient credits", 402);

    const style = IMAGE_STYLES.find((s) => s.id === styleId);
    const fullPrompt = style?.prompt ? `${prompt}, ${style.prompt}` : prompt;

    if (!hasOpenRouter()) {
      return error("OPENROUTER_API_KEY is not configured - add it to .env to generate images", 503);
    }

    // Reserve credits up front (atomic). If generation fails, refund — so a
    // failed generation is never billed and a successful one is always billed.
    const kind = inputImage ? "image-edit" : "image";
    if (!(await reserveCredits(ws.id, cost))) return error("Insufficient credits", 402);
    try {
      const rawUrl = await generateImage(model.id, fullPrompt, inputImage);
      const url = await uploadImageFromDataUrl(rawUrl);
      const image = await prisma.generatedImage.create({
        data: { workspaceId: ws.id, prompt, model: model.id, style: styleId, url },
      });
      await recordUsage(ws.id, kind, model.id, cost).catch((e) => console.error("recordUsage failed:", e));
      return json({ image });
    } catch (e) {
      await refundCredits(ws.id, cost).catch((refundErr) => console.error("refundCredits failed:", refundErr));
      throw e;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    return error(message, 500);
  }
}
