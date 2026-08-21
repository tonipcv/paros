import { requireAdmin } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { dynamicCreditsForCost, ECONOMIC_SCENARIO, OPENROUTER_CREDIT_PURCHASE_FEE_RATE, planUnitEconomics, scenarioCostUsd } from "@/lib/model-economics";
import { prisma } from "@/lib/prisma";
import { PRICING_RESEARCHED_AT } from "@/lib/provider-pricing";

export const runtime = "nodejs";

function round(value: number | null, digits = 6) {
  return value === null ? null : Number(value.toFixed(digits));
}

function csvCell(value: unknown) {
  const string = value === null || value === undefined ? "" : String(value);
  return `"${string.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    await requireAdmin("ADMIN");
    const models = await prisma.catalogModel.findMany({
      where: { status: { in: ["ACTIVE", "DEGRADED"] } },
      include: {
        routes: {
          where: { status: { in: ["ACTIVE", "DEGRADED"] }, provider: { enabled: true } },
          include: { provider: true, prices: { where: { expiresAt: null }, orderBy: { effectiveAt: "desc" } } },
          orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        },
      },
      orderBy: [{ modality: "asc" }, { publicId: "asc" }],
    });

    const rows = models.map((model) => {
      const route = model.routes[0];
      const prices = route?.prices.map((price) => ({ unit: price.unit, usd: Number(price.usd) })) || [];
      const cost = route ? scenarioCostUsd(prices, route.provider.slug, model.publicId) : null;
      const metadata = model.metadata && typeof model.metadata === "object" && !Array.isArray(model.metadata) ? model.metadata as Record<string, unknown> : {};
      return {
        model: model.publicId,
        name: model.name,
        modality: model.modality,
        provider: route?.provider.slug || null,
        providerModel: route?.providerModelId || null,
        pricing: prices,
        pricingEffectiveAt: route?.prices[0]?.effectiveAt || null,
        pricingSources: Array.isArray(metadata.pricingSources) ? metadata.pricingSources : route?.provider.slug === "openrouter" ? ["https://openrouter.ai/api/v1/models"] : [],
        pricingStatus: prices.length ? "PRICED" : "UNPRICED",
        currentCredits: model.credits,
        scenarioProviderCostUsd: round(cost?.providerCost ?? null),
        scenarioProviderFeeUsd: round(cost?.providerFee ?? null),
        scenarioAdjustedCogsUsd: round(cost?.adjustedCogs ?? null),
        recommendedDynamicCredits: cost ? dynamicCreditsForCost(cost.adjustedCogs) : null,
        plans: cost ? planUnitEconomics(model.credits, cost.adjustedCogs).map((plan) => ({
          ...plan,
          netRevenuePerCredit: "netRevenuePerCredit" in plan ? round(plan.netRevenuePerCredit ?? null) : undefined,
          revenue: round(plan.revenue), marginUsd: round(plan.marginUsd), marginPct: round(plan.marginPct, 2),
        })) : [],
      };
    });

    const format = new URL(request.url).searchParams.get("format");
    if (format === "csv") {
      const headers = ["model", "name", "modality", "provider", "pricing_status", "pricing", "current_credits", "scenario_cogs_usd", "dynamic_credits", "pro_margin_pct", "pro_plus_margin_pct", "max_margin_pct", "sources"];
      const lines = rows.map((row) => {
        const margin = (plan: string) => row.plans.find((item) => item.plan === plan)?.marginPct ?? "";
        return [row.model, row.name, row.modality, row.provider, row.pricingStatus, row.pricing.map((p) => `${p.unit}=${p.usd}`).join(";"), row.currentCredits, row.scenarioAdjustedCogsUsd, row.recommendedDynamicCredits, margin("STARTER"), margin("PRO"), margin("MAX"), row.pricingSources.join(";")].map(csvCell).join(",");
      });
      return new Response([headers.map(csvCell).join(","), ...lines].join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=model-unit-economics.csv" } });
    }

    return json({
      generatedAt: new Date().toISOString(),
      pricingResearchedAt: PRICING_RESEARCHED_AT,
      assumptions: { scenario: ECONOMIC_SCENARIO, cogsUsdPerDynamicCredit: 0.015, stripeNetRevenue: "2.9% + $0.30 per monthly payment", openRouterCreditPurchaseFeeRate: OPENROUTER_CREDIT_PURCHASE_FEE_RATE },
      summary: { models: rows.length, priced: rows.filter((row) => row.pricingStatus === "PRICED").length, unpriced: rows.filter((row) => row.pricingStatus === "UNPRICED").length },
      data: rows,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
