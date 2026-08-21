import type { ModelModality, PricingUnit, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CHAT_MODELS, CREDITS, IMAGE_MODELS } from "./models";
import type { CatalogImportModel } from "./model-catalog";
import { officialPricesFor, PRICING_RESEARCHED_AT } from "./provider-pricing";

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const SYNC_BATCH_SIZE = 10;

const openRouterModelSchema = {
  // Documentation-only shape; parsing below is intentionally defensive because providers add fields frequently.
  id: "string", name: "string", description: "string", context_length: "number",
} as const;

type OpenRouterModel = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  context_length?: unknown;
  architecture?: { input_modalities?: unknown; output_modalities?: unknown; modality?: unknown };
  pricing?: Record<string, unknown>;
  top_provider?: { max_completion_tokens?: unknown };
  supported_parameters?: unknown;
};

type SyncResult = { provider: string; discovered: number; created: number; updated: number; disabled: number };

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dollarsPerMillion(value: unknown): string | undefined {
  const perToken = Number(value);
  return Number.isFinite(perToken) && perToken >= 0 ? (perToken * 1_000_000).toFixed(8) : undefined;
}

function dollars(value: unknown): string | undefined {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(8) : undefined;
}

function directPrices(model: string) {
  return officialPricesFor(model).map((price) => ({ unit: price.unit as PricingUnit, usd: price.usd.toFixed(8) }));
}

function officialMetadata(model: string, extra: Record<string, unknown> = {}) {
  const researched = officialPricesFor(model);
  return {
    source: "bundled",
    pricingResearchedAt: PRICING_RESEARCHED_AT,
    pricingSources: researched.map((price) => price.sourceUrl),
    pricingNotes: researched.flatMap((price) => price.notes ? [price.notes] : []),
    ...extra,
  };
}

function modelModality(input: string[], output: string[]): ModelModality {
  if (output.includes("image")) return "IMAGE";
  if (output.includes("video")) return "VIDEO";
  if (output.includes("audio")) return "AUDIO";
  if (output.includes("embeddings")) return "EMBEDDING";
  return "TEXT";
}

function estimatedCredits(pricing: Record<string, unknown> | undefined): number {
  const input = Number(pricing?.prompt || 0) * 1_000_000;
  const output = Number(pricing?.completion || 0) * 1_000_000;
  const unit = Number(pricing?.image || pricing?.request || 0);
  const estimate = unit > 0 ? unit / 0.01 : Math.max(input, output) / 2;
  return Math.max(1, Math.min(100, Math.ceil(estimate || 1)));
}

function normalizeOpenRouter(raw: OpenRouterModel): CatalogImportModel | null {
  if (typeof raw.id !== "string" || !raw.id || typeof raw.name !== "string") return null;
  const input = strings(raw.architecture?.input_modalities);
  const output = strings(raw.architecture?.output_modalities);
  const supported = new Set(strings(raw.supported_parameters));
  const modality = modelModality(input, output);
  const prices: Array<{ unit: PricingUnit; usd: string }> = [];
  const prompt = dollarsPerMillion(raw.pricing?.prompt);
  const completion = dollarsPerMillion(raw.pricing?.completion);
  const cached = dollarsPerMillion(raw.pricing?.input_cache_read);
  const image = dollars(raw.pricing?.image);
  const request = dollars(raw.pricing?.request);
  if (prompt) prices.push({ unit: "MILLION_INPUT_TOKENS", usd: prompt });
  if (completion) prices.push({ unit: "MILLION_OUTPUT_TOKENS", usd: completion });
  if (cached) prices.push({ unit: "MILLION_CACHED_INPUT_TOKENS", usd: cached });
  if (image) prices.push({ unit: "IMAGE", usd: image });
  if (request) prices.push({ unit: "REQUEST", usd: request });
  return {
    publicId: raw.id,
    providerModelId: raw.id,
    name: raw.name,
    description: typeof raw.description === "string" ? raw.description : "",
    author: raw.id.split("/")[0] || "OpenRouter",
    modality,
    contextTokens: typeof raw.context_length === "number" ? raw.context_length : undefined,
    maxOutputTokens: typeof raw.top_provider?.max_completion_tokens === "number" ? raw.top_provider.max_completion_tokens : undefined,
    credits: estimatedCredits(raw.pricing),
    capabilities: {
      vision: input.includes("image"),
      videoInput: input.includes("video"),
      audioInput: input.includes("audio"),
      reasoning: supported.has("reasoning") || supported.has("include_reasoning"),
      reasoningEffort: supported.has("reasoning_effort"),
      functionCalling: supported.has("tools") || supported.has("tool_choice"),
      structuredOutput: supported.has("response_format") || supported.has("structured_outputs"),
      logProbs: supported.has("logprobs"),
      streaming: true,
      imageGeneration: modality === "IMAGE",
    },
    prices,
    metadata: {
      source: "openrouter",
      architecture: { inputModalities: input, outputModalities: output, modality: typeof raw.architecture?.modality === "string" ? raw.architecture.modality : null },
      supportedParameters: [...supported],
      schemaVersion: 1,
    },
  };
}

export function normalizeOpenRouterCatalog(payload: unknown): CatalogImportModel[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) return [];
  return (payload as { data: unknown[] }).data
    .map((item) => normalizeOpenRouter(item as OpenRouterModel))
    .filter((item): item is CatalogImportModel => Boolean(item));
}

function capabilityData(input: Record<string, boolean>) {
  const keys = [
    "vision", "videoInput", "audioInput", "reasoning", "reasoningEffort", "functionCalling",
    "structuredOutput", "logProbs", "multipleImages", "webSearch", "uncensored", "coding",
    "streaming", "tee", "e2ee", "imageGeneration", "imageEditing", "textToVideo", "imageToVideo",
  ] as const;
  return Object.fromEntries(keys.map((key) => [key, Boolean(input[key])])) as Prisma.ModelCapabilityUncheckedCreateWithoutModelInput;
}

async function importModels(providerSlug: string, providerName: string, models: CatalogImportModel[], disableMissing = true): Promise<SyncResult> {
  const provider = await prisma.modelProvider.upsert({
    where: { slug: providerSlug },
    create: { slug: providerSlug, name: providerName, baseUrl: providerSlug === "openrouter" ? OPENROUTER_BASE_URL : providerSlug === "openai" ? "https://api.openai.com/v1" : null, kind: providerSlug === "openrouter" || providerSlug === "fal" ? "AGGREGATOR" : "DIRECT" },
    update: { name: providerName, enabled: true, lastSyncedAt: new Date() },
  });
  const run = await prisma.catalogSyncRun.create({ data: { providerId: provider.id } });
  let created = 0;
  let updated = 0;
  try {
    for (let offset = 0; offset < models.length; offset += SYNC_BATCH_SIZE) {
      const batch = models.slice(offset, offset + SYNC_BATCH_SIZE);
      const results = await Promise.all(batch.map(async (item) => {
        const existed = await prisma.catalogModel.findUnique({ where: { publicId: item.publicId }, select: { id: true } });
        const model = await prisma.catalogModel.upsert({
          where: { publicId: item.publicId },
          create: {
            publicId: item.publicId, name: item.name, description: item.description || "", author: item.author || "",
            modality: item.modality, status: "ACTIVE", contextTokens: item.contextTokens,
            maxOutputTokens: item.maxOutputTokens, credits: item.credits, metadata: item.metadata || {},
            capabilities: { create: capabilityData(item.capabilities) },
          },
          update: {
            name: item.name, description: item.description || "", author: item.author || "", modality: item.modality,
            status: "ACTIVE", contextTokens: item.contextTokens, maxOutputTokens: item.maxOutputTokens,
            credits: item.credits, metadata: item.metadata || {}, capabilities: { upsert: {
              create: capabilityData(item.capabilities), update: capabilityData(item.capabilities),
            } },
          },
        });
        const route = await prisma.modelRoute.upsert({
          where: { providerId_providerModelId: { providerId: provider.id, providerModelId: item.providerModelId } },
          create: { modelId: model.id, providerId: provider.id, providerModelId: item.providerModelId, status: "ACTIVE" },
          update: { modelId: model.id, status: "ACTIVE", lastError: null },
        });
        await prisma.modelPrice.deleteMany({ where: { routeId: route.id, expiresAt: null } });
        if (item.prices?.length) {
          await prisma.modelPrice.createMany({ data: item.prices.map((price) => ({ modelId: model.id, routeId: route.id, unit: price.unit, usd: price.usd })) });
        }
        return Boolean(existed);
      }));
      updated += results.filter(Boolean).length;
      created += results.filter((value) => !value).length;
    }
    const ids = models.map((model) => model.providerModelId);
    const disabled = disableMissing ? await prisma.modelRoute.updateMany({
      where: { providerId: provider.id, providerModelId: { notIn: ids }, status: { not: "DISABLED" } },
      data: { status: "DISABLED", lastError: "Not present in the latest provider catalog" },
    }) : { count: 0 };
    await prisma.catalogSyncRun.update({
      where: { id: run.id },
      data: { status: "SUCCEEDED", discovered: models.length, created, updated, disabled: disabled.count, completedAt: new Date() },
    });
    return { provider: providerSlug, discovered: models.length, created, updated, disabled: disabled.count };
  } catch (error) {
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 2000) : String(error), completedAt: new Date() } }).catch(() => undefined);
    throw error;
  }
}

export async function syncOpenRouterCatalog(): Promise<SyncResult> {
  const headers: Record<string, string> = {};
  if (process.env.OPENROUTER_API_KEY) headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  const response = await fetch(`${OPENROUTER_BASE_URL.replace(/\/$/, "")}/models`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`OpenRouter catalog returned ${response.status}`);
  const payload = await response.json();
  const embeddingsResponse = await fetch(`${OPENROUTER_BASE_URL.replace(/\/$/, "")}/embeddings/models`, { headers, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  const embeddingsPayload = embeddingsResponse?.ok ? await embeddingsResponse.json() : { data: [] };
  const deduplicated = new Map<string, CatalogImportModel>();
  for (const model of [...normalizeOpenRouterCatalog(payload), ...normalizeOpenRouterCatalog(embeddingsPayload)]) deduplicated.set(model.publicId, model);
  const models = [...deduplicated.values()];
  if (!models.length) throw new Error(`Invalid or empty OpenRouter catalog payload (${openRouterModelSchema.id} id expected)`);
  return importModels("openrouter", "OpenRouter", models);
}

export async function syncBundledCatalog() {
  const openrouter: CatalogImportModel[] = CHAT_MODELS.map((model) => ({
    publicId: model.id, providerModelId: model.id, name: model.name, description: model.description,
    author: model.provider, modality: "TEXT", contextTokens: undefined, maxOutputTokens: model.maxOutput,
    credits: model.credits, capabilities: { vision: Boolean(model.vision), reasoning: Boolean(model.reasoning), uncensored: Boolean(model.uncensored), functionCalling: true, streaming: true },
    metadata: { source: "bundled", contextLabel: model.context },
  }));
  const grouped = new Map<string, CatalogImportModel[]>();
  for (const model of IMAGE_MODELS) {
    const provider = model.provider || "openrouter";
    const list = grouped.get(provider) || [];
    const researched = officialPricesFor(model.id);
    list.push({ publicId: model.id, providerModelId: model.id, name: model.name, author: provider, modality: "IMAGE", credits: model.credits, capabilities: { imageGeneration: true, uncensored: Boolean(model.uncensored) }, prices: researched.length ? directPrices(model.id) : undefined, metadata: researched.length ? officialMetadata(model.id) : { source: "bundled" } });
    grouped.set(provider, list);
  }
  const results = [await importModels("openrouter", "OpenRouter", [...openrouter, ...(grouped.get("openrouter") || [])], false)];
  for (const [provider, models] of grouped) if (provider !== "openrouter") results.push(await importModels(provider, provider === "fal" ? "fal.ai" : provider, models, false));
  results.push(await importModels("fal", "fal.ai", [
    { publicId: "fal-ai/vidu/q3/text-to-video", providerModelId: "fal-ai/vidu/q3/text-to-video", name: "Vidu Q3 Text to Video", author: "Vidu", modality: "VIDEO", credits: 30, capabilities: { textToVideo: true }, prices: directPrices("fal-ai/vidu/q3/text-to-video"), metadata: officialMetadata("fal-ai/vidu/q3/text-to-video", { async: true }) },
    { publicId: "fal-ai/wan/v2.7/text-to-video", providerModelId: "fal-ai/wan/v2.7/text-to-video", name: "Wan 2.7 Text to Video", author: "Wan", modality: "VIDEO", credits: 40, capabilities: { textToVideo: true }, prices: directPrices("fal-ai/wan/v2.7/text-to-video"), metadata: officialMetadata("fal-ai/wan/v2.7/text-to-video", { async: true, maxDurationSeconds: 15 }) },
    { publicId: "fal-ai/inpaint", providerModelId: "fal-ai/inpaint", name: "SDXL Inpaint", author: "Stability AI", modality: "INPAINT", credits: 6, capabilities: { imageEditing: true }, metadata: { source: "bundled", async: true } },
    { publicId: "fal-ai/topaz/upscale/image", providerModelId: "fal-ai/topaz/upscale/image", name: "Topaz Image Upscale", author: "Topaz Labs", modality: "UPSCALE", credits: 10, capabilities: { imageEditing: true }, prices: directPrices("fal-ai/topaz/upscale/image"), metadata: officialMetadata("fal-ai/topaz/upscale/image", { async: true }) },
    { publicId: "fal-ai/stable-audio-25/text-to-audio", providerModelId: "fal-ai/stable-audio-25/text-to-audio", name: "Stable Audio 2.5", author: "Stability AI", modality: "MUSIC", credits: 20, capabilities: {}, prices: directPrices("fal-ai/stable-audio-25/text-to-audio"), metadata: officialMetadata("fal-ai/stable-audio-25/text-to-audio", { async: true }) },
  ], false));
  results.push(await importModels("openai", "OpenAI", [
    { publicId: "openai/tts-1", providerModelId: "tts-1", name: "TTS 1", author: "OpenAI", modality: "TTS", credits: CREDITS.tts, capabilities: {}, prices: directPrices("openai/tts-1"), metadata: officialMetadata("openai/tts-1") },
    { publicId: "openai/gpt-4o-transcribe", providerModelId: "gpt-4o-transcribe", name: "GPT-4o Transcribe", author: "OpenAI", modality: "ASR", credits: CREDITS.stt, capabilities: { audioInput: true }, prices: directPrices("openai/gpt-4o-transcribe"), metadata: officialMetadata("openai/gpt-4o-transcribe") },
    { publicId: "openai/gpt-4o-mini-transcribe", providerModelId: "gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe", author: "OpenAI", modality: "ASR", credits: CREDITS.stt, capabilities: { audioInput: true }, prices: directPrices("openai/gpt-4o-mini-transcribe"), metadata: officialMetadata("openai/gpt-4o-mini-transcribe") },
    { publicId: "openai/whisper-1", providerModelId: "whisper-1", name: "Whisper 1", author: "OpenAI", modality: "ASR", credits: CREDITS.stt, capabilities: { audioInput: true }, prices: directPrices("openai/whisper-1"), metadata: officialMetadata("openai/whisper-1") },
  ], false));
  return results;
}
