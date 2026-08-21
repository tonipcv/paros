const BASE_URL = "https://fal.run";

export function hasFal() {
  return Boolean(process.env.FAL_KEY);
}

export async function generateImage(
  modelId: string,
  prompt: string,
  inputImage?: string
): Promise<string> {
  return (await generateImageDetailed(modelId, prompt, inputImage)).url;
}

const COST_PER_MEGAPIXEL_USD: Record<string, number> = {
  "fal-ai/flux/schnell": 0.003,
  "fal-ai/flux/dev": 0.025,
  "fal-ai/flux-pro/v1.1": 0.04,
};

const COST_PER_IMAGE_USD: Record<string, number> = {
  "fal-ai/flux-pro/v1.1-ultra": 0.06,
};

export async function generateImageDetailed(
  modelId: string,
  prompt: string,
  inputImage?: string,
  options: { aspectRatio?: string; quality?: string; negativePrompt?: string; seed?: number; safeMode?: boolean } = {}
): Promise<{ url: string; providerRequestId?: string; costUsd?: number; width?: number; height?: number; megapixels?: number }> {
  const key = process.env.FAL_KEY || "";
  const body: Record<string, unknown> = {
    prompt,
    enable_safety_checker: options.safeMode !== false,
    image_size: ({
      "1:1": "square_hd", "4:5": "portrait_4_3", "3:4": "portrait_4_3",
      "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3",
    } as Record<string, string>)[options.aspectRatio || "1:1"] || "square_hd",
    num_images: 1,
    output_format: "png",
  };
  if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
  if (typeof options.seed === "number") body.seed = options.seed;
  if (options.quality === "max") body.num_inference_steps = 40;
  if (options.quality === "fast") body.num_inference_steps = 20;
  if (inputImage) body.image_url = inputImage;

  const res = await fetch(`${BASE_URL}/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fal.ai error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const url: string | undefined = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned by Fal.ai");
  const width = typeof data.images?.[0]?.width === "number" ? data.images[0].width : undefined;
  const height = typeof data.images?.[0]?.height === "number" ? data.images[0].height : undefined;
  const megapixels = width && height ? Math.max(1, Math.ceil(width * height / 1_000_000)) : undefined;
  const unitCost = COST_PER_MEGAPIXEL_USD[modelId];
  const imageCost = COST_PER_IMAGE_USD[modelId];
  return {
    url,
    providerRequestId: typeof data.request_id === "string" ? data.request_id : undefined,
    costUsd: imageCost ?? (unitCost !== undefined && megapixels !== undefined ? unitCost * megapixels : undefined),
    width,
    height,
    megapixels,
  };
}
