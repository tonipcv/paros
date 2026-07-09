import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";
import { handleRouteError } from "@/lib/http";
import { latestSummary } from "@/lib/monitor";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin("ADMIN");
    const [totalUsers, freeUsers, activeSessions, guestCount, totalCredits, health, usersByDay, creditsByDay, todayActive] =
      await Promise.all([
        prisma.user.count(),
        prisma.workspace.count({ where: { plan: "FREE" } }),
        prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
        prisma.user.count({ where: { email: { startsWith: "guest_", endsWith: "@guest.local" } } }),
        prisma.workspace.aggregate({ _sum: { credits: true } }).then((r) => r._sum.credits ?? 0),
        latestSummary(),
        // Users created per day (last 30 days)
        prisma.$queryRaw<{ day: string; count: number }[]>`
          SELECT DATE("createdAt") AS day, COUNT(*)::int AS count
          FROM "users" WHERE "createdAt" > NOW() - INTERVAL '30 days'
          GROUP BY day ORDER BY day ASC
        `.catch(() => []),
        // Credits consumed per day (last 30 days)
        prisma.$queryRaw<{ day: string; credits: number }[]>`
          SELECT DATE("createdAt") AS day, SUM("credits")::int AS credits
          FROM "usage_events" WHERE "createdAt" > NOW() - INTERVAL '30 days'
          GROUP BY day ORDER BY day ASC
        `.catch(() => []),
        // Today's active users (unique workspace ids with usage in last 24h)
        prisma.$queryRaw<{ count: number }[]>`
          SELECT COUNT(DISTINCT "workspaceId")::int AS count
          FROM "usage_events" WHERE "createdAt" > NOW() - INTERVAL '24 hours'
        `.then((r) => r[0]?.count ?? 0).catch(() => 0),
      ]);

    return json({
      users: { total: totalUsers, free: freeUsers, guests: guestCount, activeSessions, todayActive },
      credits: { total: totalCredits },
      health: { degraded: health.degraded, total: health.total },
      trends: {
        usersByDay: usersByDay || [],
        creditsByDay: creditsByDay || [],
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
