import { prisma } from "@/lib/prisma";
import { reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { generateImage, hasOpenRouter } from "@/lib/openrouter";
import { uploadImageFromDataUrl } from "@/lib/storage";
import { IMAGE_MODELS } from "@/lib/models";
import { authenticateApiKey } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const body = await request.json();
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return Response.json({ error: { message: "prompt required" } }, { status: 400 });

  const model = IMAGE_MODELS.find((m) => m.id === body.model) || IMAGE_MODELS[0];

  // Reserve credits atomically; refund if generation fails.
  if (!(await reserveCredits(auth.workspace.id, model.credits))) {
    return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  }
  try {
    const rawUrl = await generateImage(model.id, prompt);
    const url = await uploadImageFromDataUrl(rawUrl);
    await prisma.generatedImage
      .create({ data: { workspaceId: auth.workspace.id, prompt, model: model.id, style: "none", url } })
      .catch((e) => console.error("generated image persistence failed:", e));
    await recordUsage(auth.workspace.id, "api-image", model.id, model.credits).catch((e) => console.error("recordUsage failed:", e));
    return Response.json({ created: Math.floor(Date.now() / 1000), data: [{ url }] });
  } catch (e) {
    await refundCredits(auth.workspace.id, model.credits).catch((refundErr) => console.error("refundCredits failed:", refundErr));
    console.error("api image generation failed:", e);
    return Response.json({ error: { message: "Image generation failed" } }, { status: 500 });
  }
}
