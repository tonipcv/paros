import { prisma } from "./prisma";
import { estimateTextCostMicros, usdToMicros } from "./unit-economics";

const OPENROUTER_CREDIT_FEE_RATE = 0.055;
// whisper-1 default when no MINUTE price exists for the model
const ASR_DEFAULT_USD_PER_MINUTE = 0.006;

export async function estimateCatalogTextRequest(modelId: string, inputTokens: number, maxOutputTokens: number) {
  const model = await prisma.catalogModel.findUnique({
    where: { publicId: modelId },
    select: {
      prices: {
        where: { expiresAt: null },
        orderBy: { effectiveAt: "desc" },
        select: { unit: true, usd: true, effectiveAt: true, route: { select: { provider: { select: { slug: true } } } } },
      },
    },
  });
  if (!model) return null;

  const latest = new Map<string, typeof model.prices[number]>();
  for (const price of model.prices) if (!latest.has(price.unit)) latest.set(price.unit, price);
  const input = latest.get("MILLION_INPUT_TOKENS");
  const output = latest.get("MILLION_OUTPUT_TOKENS");
  if (!input || !output) return null;
  const cached = latest.get("MILLION_CACHED_INPUT_TOKENS");
  const provider = input.route?.provider.slug || output.route?.provider.slug || "unknown";
  const providerFeeRate = provider === "openrouter" ? OPENROUTER_CREDIT_FEE_RATE : 0;
  const estimatedCostMicros = estimateTextCostMicros({
    inputUsdPerMillion: Number(input.usd),
    outputUsdPerMillion: Number(output.usd),
    cachedInputUsdPerMillion: cached ? Number(cached.usd) : undefined,
    providerFeeRate,
  }, { inputTokens, outputTokens: maxOutputTokens });
  const effectiveAt = [input.effectiveAt, output.effectiveAt, cached?.effectiveAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
  return {
    provider,
    estimatedCostMicros,
    pricingVersion: `${modelId}:${effectiveAt?.toISOString() || "unknown"}`,
    providerFeeRate,
  };
}

export async function estimateAudioCostMicros(modelId: string, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0n;
  const model = await prisma.catalogModel.findUnique({
    where: { publicId: modelId },
    select: {
      prices: {
        where: { expiresAt: null, unit: "MINUTE" },
        orderBy: { effectiveAt: "desc" }, take: 1,
        select: { usd: true },
      },
    },
  });
  const usdPerMinute = model?.prices[0] ? Number(model.prices[0].usd) : ASR_DEFAULT_USD_PER_MINUTE;
  return usdToMicros(usdPerMinute * (seconds / 60));
}

export async function estimateCatalogInputRequest(modelId: string, inputTokens: number) {
  const model = await prisma.catalogModel.findUnique({
    where: { publicId: modelId },
    select: {
      prices: {
        where: { expiresAt: null, unit: "MILLION_INPUT_TOKENS" },
        orderBy: { effectiveAt: "desc" }, take: 1,
        select: { usd: true, effectiveAt: true, route: { select: { provider: { select: { slug: true } } } } },
      },
    },
  });
  const price = model?.prices[0];
  if (!price) return null;
  const provider = price.route?.provider.slug || "unknown";
  const providerFeeRate = provider === "openrouter" ? OPENROUTER_CREDIT_FEE_RATE : 0;
  return {
    provider,
    estimatedCostMicros: estimateTextCostMicros({
      inputUsdPerMillion: Number(price.usd), outputUsdPerMillion: 0, providerFeeRate,
    }, { inputTokens, outputTokens: 0 }),
    pricingVersion: `${modelId}:${price.effectiveAt.toISOString()}`,
    providerFeeRate,
  };
}
