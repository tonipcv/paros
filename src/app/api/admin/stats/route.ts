import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";
import { handleRouteError } from "@/lib/http";
import { latestSummary } from "@/lib/monitor";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin("ADMIN");
    const [totalUsers, freeUsers, activeSessions, guestCount, totalCredits, health] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count({ where: { plan: "FREE" } }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.user.count({ where: { email: { startsWith: "guest_", endsWith: "@guest.local" } } }),
      prisma.workspace
        .aggregate({ _sum: { credits: true } })
        .then((r) => r._sum.credits ?? 0),
      latestSummary(),
    ]);
    return json({
      users: { total: totalUsers, free: freeUsers, guests: guestCount, activeSessions },
      credits: { total: totalCredits },
      health: { degraded: health.degraded, total: health.total },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
