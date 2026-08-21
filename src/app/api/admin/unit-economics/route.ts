import { requireAdmin } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SummaryRow = {
  requests: number;
  reserved_micros: bigint;
  settled_micros: bigint;
  provider_micros: bigint;
  fee_micros: bigint;
  credits_reserved: number;
  credits_settled: number;
};

const serialize = (value: unknown): unknown => typeof value === "bigint"
  ? value.toString()
  : Array.isArray(value)
    ? value.map(serialize)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
      : value;

export async function GET() {
  try {
    await requireAdmin("ADMIN");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [summary, byStatus, byPlan, byModel, percentiles, unreconciled, missingCosts] = await Promise.all([
      prisma.$queryRaw<SummaryRow[]>`
        SELECT COUNT(*)::int requests,
          COALESCE(SUM("reservedCostMicros"), 0) reserved_micros,
          COALESCE(SUM("settledCostMicros"), 0) settled_micros,
          COALESCE(SUM("providerCostMicros"), 0) provider_micros,
          COALESCE(SUM("providerFeeMicros"), 0) fee_micros,
          COALESCE(SUM("creditsReserved"), 0)::int credits_reserved,
          COALESCE(SUM("creditsSettled"), 0)::int credits_settled
        FROM "billing_ledger" WHERE "createdAt" >= ${since}
      `,
      prisma.billingLedger.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { settledCostMicros: true } }),
      prisma.$queryRaw<Array<{ plan: string; requests: number; settled_micros: bigint; credits_settled: number }>>`
        SELECT w.plan::text plan, COUNT(*)::int requests,
          COALESCE(SUM(b."settledCostMicros"), 0) settled_micros,
          COALESCE(SUM(b."creditsSettled"), 0)::int credits_settled
        FROM "billing_ledger" b JOIN "workspaces" w ON w.id = b."workspaceId"
        WHERE b."createdAt" >= ${since}
        GROUP BY w.plan ORDER BY settled_micros DESC
      `,
      prisma.billingLedger.groupBy({
        by: ["model", "modality"], where: { createdAt: { gte: since } },
        _count: { _all: true }, _sum: { settledCostMicros: true, creditsSettled: true },
        orderBy: { _sum: { settledCostMicros: "desc" } }, take: 25,
      }),
      prisma.$queryRaw<Array<{ p50_micros: number; p90_micros: number; p99_micros: number }>>`
        SELECT
          COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "settledCostMicros"), 0)::float8 p50_micros,
          COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY "settledCostMicros"), 0)::float8 p90_micros,
          COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "settledCostMicros"), 0)::float8 p99_micros
        FROM "billing_ledger" WHERE status = 'SETTLED' AND "createdAt" >= ${since}
      `,
      prisma.billingLedger.count({ where: { status: "RECONCILIATION_REQUIRED", createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } } }),
      prisma.billingLedger.count({ where: { status: "SETTLED", settledCostMicros: 0n, createdAt: { gte: since } } }),
    ]);

    return json(serialize({
      windowDays: 30,
      summary: summary[0] || null,
      percentiles: percentiles[0] || null,
      byStatus,
      byPlan,
      byModel,
      alerts: {
        unreconciledOlderThan15Minutes: unreconciled,
        settledWithoutCost: missingCosts,
        healthy: unreconciled === 0 && missingCosts === 0,
      },
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
