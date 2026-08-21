import type { PricingUnit } from "@prisma/client";
import { PLANS, YEARLY_DISCOUNT } from "./models";
import { falVideoCostUsd, topazImageCostUsd } from "./provider-pricing";

export const ECONOMIC_SCENARIO = {
  text: { inputTokens: 2_000, outputTokens: 1_000, cachedInputTokens: 0 },
  image: { megapixels: 2, images: 1 },
  video: { seconds: 5 },
  asr: { minutes: 1 },
  tts: { characters: 1_000 },
  generic: { requests: 1 },
} as const;

export const OPENROUTER_CREDIT_PURCHASE_FEE_RATE = 0.055;

type Price = { unit: PricingUnit; usd: number };

function amount(unit: PricingUnit) {
  switch (unit) {
    case "MILLION_INPUT_TOKENS": return ECONOMIC_SCENARIO.text.inputTokens / 1_000_000;
    case "MILLION_OUTPUT_TOKENS": return ECONOMIC_SCENARIO.text.outputTokens / 1_000_000;
    case "MILLION_CACHED_INPUT_TOKENS": return ECONOMIC_SCENARIO.text.cachedInputTokens / 1_000_000;
    case "MEGAPIXEL": return ECONOMIC_SCENARIO.image.megapixels;
    case "IMAGE": return ECONOMIC_SCENARIO.image.images;
    case "SECOND": return ECONOMIC_SCENARIO.video.seconds;
    case "MINUTE": return ECONOMIC_SCENARIO.asr.minutes;
    case "CHARACTER": return ECONOMIC_SCENARIO.tts.characters;
    case "REQUEST": return ECONOMIC_SCENARIO.generic.requests;
  }
}

export function scenarioCostUsd(prices: Price[], provider: string, model?: string) {
  if (!prices.length) return null;
  const specializedCost = model === "fal-ai/vidu/q3/text-to-video"
    ? falVideoCostUsd(model, ECONOMIC_SCENARIO.video.seconds, "720p")
    : model === "fal-ai/wan/v2.7/text-to-video"
      ? falVideoCostUsd(model, ECONOMIC_SCENARIO.video.seconds, "1080p")
      : model === "fal-ai/topaz/upscale/image"
        ? topazImageCostUsd(ECONOMIC_SCENARIO.image.megapixels)
        : undefined;
  const providerCost = specializedCost ?? prices.reduce((sum, price) => sum + price.usd * amount(price.unit), 0);
  const providerFee = provider === "openrouter" ? providerCost * OPENROUTER_CREDIT_PURCHASE_FEE_RATE : 0;
  return { providerCost, providerFee, adjustedCogs: providerCost + providerFee };
}

export function planUnitEconomics(creditsCharged: number, adjustedCogs: number) {
  return PLANS.map((plan) => {
    if (plan.price <= 0) return { plan: plan.id, name: plan.name, revenue: 0, marginUsd: -adjustedCogs, marginPct: null };
    const netMonthlyRevenue = plan.price * 0.971 - 0.30;
    const netRevenuePerCredit = netMonthlyRevenue / plan.credits;
    const revenue = creditsCharged * netRevenuePerCredit;
    return {
      plan: plan.id,
      name: plan.name,
      netRevenuePerCredit,
      revenue,
      marginUsd: revenue - adjustedCogs,
      marginPct: revenue > 0 ? ((revenue - adjustedCogs) / revenue) * 100 : null,
      annual: {
        netRevenuePerCredit: ((plan.price * YEARLY_DISCOUNT) * 0.971 - 0.30 / 12) / plan.credits,
      },
    };
  });
}

export function dynamicCreditsForCost(adjustedCogs: number) {
  return Math.max(1, Math.ceil(adjustedCogs / 0.015));
}
