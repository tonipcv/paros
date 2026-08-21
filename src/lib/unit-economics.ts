export const COGS_MICROS_PER_CREDIT = 15_000n;
export const RESERVATION_BUFFER_BPS = 1_500n;
export const CREDIT_POLICY_VERSION = "cogs-v1";

export type TextPricing = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cachedInputUsdPerMillion?: number;
  providerFeeRate?: number;
};

export type TextUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
};

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.ceil(value)) : 0;
}

export function usdToMicros(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) return 0n;
  return BigInt(Math.ceil(usd * 1_000_000));
}

export function estimateTextCostMicros(pricing: TextPricing, usage: TextUsage): bigint {
  const inputTokens = nonNegativeInteger(usage.inputTokens);
  const outputTokens = nonNegativeInteger(usage.outputTokens);
  const cachedTokens = Math.min(inputTokens, nonNegativeInteger(usage.cachedInputTokens || 0));
  const regularInputTokens = inputTokens - cachedTokens;
  const inputCost = regularInputTokens * pricing.inputUsdPerMillion / 1_000_000;
  const cachedCost = cachedTokens * (pricing.cachedInputUsdPerMillion ?? pricing.inputUsdPerMillion) / 1_000_000;
  const outputCost = outputTokens * pricing.outputUsdPerMillion / 1_000_000;
  const providerFeeRate = Math.max(0, pricing.providerFeeRate || 0);
  return usdToMicros((inputCost + cachedCost + outputCost) * (1 + providerFeeRate));
}

export function creditsForCost(costMicros: bigint): number {
  if (costMicros <= 0n) return 1;
  return Number((costMicros + COGS_MICROS_PER_CREDIT - 1n) / COGS_MICROS_PER_CREDIT);
}

export function creditsToReserve(estimatedCostMicros: bigint): number {
  const buffered = estimatedCostMicros <= 0n
    ? 0n
    : (estimatedCostMicros * (10_000n + RESERVATION_BUFFER_BPS) + 9_999n) / 10_000n;
  return creditsForCost(buffered);
}

export function settleCredits(creditsReserved: number, actualCostMicros: bigint) {
  const creditsSettled = creditsForCost(actualCostMicros);
  return {
    creditsSettled,
    creditsRefunded: Math.max(0, creditsReserved - creditsSettled),
    creditsAdditional: Math.max(0, creditsSettled - creditsReserved),
  };
}

export function parseTokenCount(value: string): number | undefined {
  const match = value.trim().toUpperCase().match(/^([\d.]+)\s*([KMB])?$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const multiplier = match[2] === "B" ? 1_000_000_000 : match[2] === "M" ? 1_000_000 : match[2] === "K" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}
