import { prisma } from "@/lib/prisma";
import { reserveCredits, refundCredits, recordUsage } from "@/lib/account";
import { generateImageDetailed as generateImageOR, hasOpenRouter } from "@/lib/openrouter";
import { generateImageDetailed as generateImageFal, hasFal } from "@/lib/fal";
import { uploadImageFromDataUrl } from "@/lib/storage";
import { authenticateApiKey } from "@/lib/api-auth";
import { recordModelRouteOutcome, resolveCatalogModel } from "@/lib/model-catalog";
import { createBillingReservation, markBillingSent, releaseBillingReservation, requireBillingReconciliation, settleBillingReservation } from "@/lib/billing-engine";
import { usdToMicros } from "@/lib/unit-economics";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PROMPT_CHARS = 8000;

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return Response.json(
      { error: { message: auth.message } },
      { status: auth.status, headers: auth.retryAfter ? { "Retry-After": String(auth.retryAfter) } : {} }
    );
  }
  if (!hasOpenRouter() && !hasFal()) {
    return Response.json({ error: { message: "Inference backend not configured" } }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: { message: "Request body too large", type: "invalid_request_error", code: "body_too_large" } }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: { message: "Invalid JSON body", type: "invalid_request_error", code: "invalid_json" } }, { status: 400 });
  }
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return Response.json({ error: { message: "prompt required" } }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) return Response.json({ error: { message: "prompt is too long" } }, { status: 400 });

  const modelId = typeof body.model === "string" ? body.model : "google/gemini-2.5-flash-image";
  const model = await resolveCatalogModel(modelId, "IMAGE");
  if (!model) {
    return Response.json(
      { error: { message: `Model '${modelId || "(missing)"}' does not exist`, type: "invalid_request_error", param: "model", code: "model_not_found" } },
      { status: 404 }
    );
  }

  // Reserve credits atomically; refund if generation fails.
  if (!(await reserveCredits(auth.workspace.id, model.credits))) {
    return Response.json({ error: { message: "Insufficient credits" } }, { status: 402 });
  }
  const estimatedCostMicros = 80_000n;
  const shadowReservation = await createBillingReservation({
    workspaceId: auth.workspace.id,
    provider: model.route.provider,
    model: model.id,
    modality: "IMAGE",
    estimatedCostMicros,
    pricingVersion: `image-shadow:${model.id}:2026-07-24`,
    modeOverride: "shadow",
    metadata: { surface: "api", legacyCreditsCharged: model.credits, estimateSource: "temporary-cap" },
  }).catch((billingError) => { console.error("API image shadow billing reservation failed:", billingError); return null; });
  const generationStartedAt = Date.now();
  try {
    let generated: Awaited<ReturnType<typeof generateImageOR>> | undefined;
    let lastError: unknown;
    for (const route of model.routes) {
      if (!['fal', 'openrouter'].includes(route.provider)) continue;
      const startedAt = Date.now();
      try {
        if (shadowReservation) await markBillingSent(shadowReservation.id).catch(() => undefined);
        generated = route.provider === "fal"
          ? await generateImageFal(route.providerModelId, prompt)
          : await generateImageOR(route.providerModelId, prompt);
        await recordModelRouteOutcome(route.id, true, Date.now() - startedAt);
        break;
      } catch (error) {
        lastError = error;
        await recordModelRouteOutcome(route.id, false, Date.now() - startedAt, error instanceof Error ? error.message : String(error));
      }
    }
    if (!generated) throw lastError || new Error("No supported image provider route is configured");
    const url = await uploadImageFromDataUrl(generated.url);
    await prisma.generatedImage
      .create({ data: { workspaceId: auth.workspace.id, prompt, model: model.id, style: "none", url } })
      .catch((e) => console.error("generated image persistence failed:", e));
    const actualCostMicros = generated.costUsd === undefined ? undefined : usdToMicros(generated.costUsd);
    await recordUsage(auth.workspace.id, "api-image", model.id, model.credits, { cost: generated.costUsd, generationId: generated.providerRequestId }).catch((e) => console.error("recordUsage failed:", e));
    if (actualCostMicros === undefined) {
      if (shadowReservation) await requireBillingReconciliation(shadowReservation.id, generated.providerRequestId).catch(() => undefined);
    } else if (shadowReservation) {
      await settleBillingReservation(shadowReservation.id, {
        providerRequestId: generated.providerRequestId,
        providerCostMicros: actualCostMicros,
        providerFeeMicros: model.route.provider === "openrouter" ? (actualCostMicros * 55n + 999n) / 1000n : 0n,
        imageMegapixels: generated.megapixels,
        imageCount: 1,
      }).catch(() => undefined);
    }
    return Response.json({ created: Math.floor(Date.now() / 1000), data: [{ url }] });
  } catch (e) {
    if (!model.routes.some((route) => route.id)) await recordModelRouteOutcome(model.route.id, false, Date.now() - generationStartedAt, e instanceof Error ? e.message : String(e));
    await refundCredits(auth.workspace.id, model.credits).catch((refundErr) => console.error("refundCredits failed:", refundErr));
    if (shadowReservation) await releaseBillingReservation(shadowReservation.id, true).catch(() => undefined);
    console.error("api image generation failed:", e);
    return Response.json({ error: { message: "Image generation failed" } }, { status: 500 });
  }
}
