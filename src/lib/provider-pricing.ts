export const PRICING_RESEARCHED_AT = "2026-07-24";

export type OfficialProviderPrice = {
  model: string;
  provider: "fal" | "openai";
  unit: "MEGAPIXEL" | "IMAGE" | "SECOND" | "MINUTE" | "CHARACTER" | "REQUEST";
  usd: number;
  sourceUrl: string;
  notes?: string;
};

/** Direct-provider prices used by the product, verified against official supplier pages. */
export const OFFICIAL_PROVIDER_PRICES: OfficialProviderPrice[] = [
  { model: "fal-ai/flux/schnell", provider: "fal", unit: "MEGAPIXEL", usd: 0.003, sourceUrl: "https://fal.ai/models/fal-ai/flux/schnell" },
  { model: "fal-ai/flux/dev", provider: "fal", unit: "MEGAPIXEL", usd: 0.025, sourceUrl: "https://fal.ai/models/fal-ai/flux-1/dev" },
  { model: "fal-ai/flux-pro/v1.1", provider: "fal", unit: "MEGAPIXEL", usd: 0.04, sourceUrl: "https://fal.ai/docs/model-api-reference/image-generation-api/flux-pro-v1.1" },
  { model: "fal-ai/flux-pro/v1.1-ultra", provider: "fal", unit: "IMAGE", usd: 0.06, sourceUrl: "https://fal.ai/models/fal-ai/flux-pro/v1.1-ultra" },
  { model: "fal-ai/vidu/q3/text-to-video", provider: "fal", unit: "SECOND", usd: 0.07, sourceUrl: "https://fal.ai/models/fal-ai/vidu/q3/text-to-video", notes: "360p/540p; 720p/1080p costs 2.2x" },
  { model: "fal-ai/wan/v2.7/text-to-video", provider: "fal", unit: "SECOND", usd: 0.10, sourceUrl: "https://fal.ai/models/fal-ai/wan/v2.7/text-to-video", notes: "720p; 1080p costs $0.15/second" },
  { model: "fal-ai/topaz/upscale/image", provider: "fal", unit: "IMAGE", usd: 0.08, sourceUrl: "https://fal.ai/models/fal-ai/topaz/upscale/image", notes: "up to 24MP; $0.16 <=48MP, $0.32 <=96MP, up to $1.36 at 512MP" },
  { model: "fal-ai/stable-audio-25/text-to-audio", provider: "fal", unit: "REQUEST", usd: 0.20, sourceUrl: "https://fal.ai/models/fal-ai/stable-audio-25/text-to-audio" },
  { model: "openai/tts-1", provider: "openai", unit: "CHARACTER", usd: 0.000015, sourceUrl: "https://developers.openai.com/api/docs/models/tts-1" },
  { model: "openai/gpt-4o-transcribe", provider: "openai", unit: "MINUTE", usd: 0.006, sourceUrl: "https://developers.openai.com/api/docs/pricing" },
  { model: "openai/gpt-4o-mini-transcribe", provider: "openai", unit: "MINUTE", usd: 0.003, sourceUrl: "https://developers.openai.com/api/docs/pricing" },
  { model: "openai/whisper-1", provider: "openai", unit: "MINUTE", usd: 0.006, sourceUrl: "https://developers.openai.com/api/docs/models/whisper-1" },
];

export function officialPricesFor(model: string) {
  return OFFICIAL_PROVIDER_PRICES.filter((price) => price.model === model);
}

export function topazImageCostUsd(outputMegapixels: number) {
  if (outputMegapixels <= 24) return 0.08;
  if (outputMegapixels <= 48) return 0.16;
  if (outputMegapixels <= 96) return 0.32;
  return Math.min(1.36, Math.ceil(outputMegapixels / 24) * 0.08);
}

export function falVideoCostUsd(model: string, seconds: number, resolution: string) {
  if (model === "fal-ai/vidu/q3/text-to-video") return seconds * 0.07 * (["720p", "1080p"].includes(resolution) ? 2.2 : 1);
  if (model === "fal-ai/wan/v2.7/text-to-video") return seconds * (resolution === "1080p" ? 0.15 : 0.10);
  return undefined;
}

export function tts1CostMicros(characters: number) {
  return BigInt(Math.max(0, Math.min(4_000, Math.trunc(characters)))) * 15n;
}
