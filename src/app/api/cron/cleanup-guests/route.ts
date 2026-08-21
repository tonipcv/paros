import { prisma } from "@/lib/prisma";
import { timingSafeEqual, createHash } from "node:crypto";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Deletes guest accounts that are older than the retention window and have no
// active (non-expired) session. Guests are ephemeral — this bounds unlimited
// growth of throwaway User/Workspace rows. Cascades remove their data.
// Also prunes rate-limit rows that stopped being touched: the shared limiter
// keeps one row per key and window, so stale rows would otherwise grow forever.
const RETENTION_DAYS = 7;
const RATE_LIMIT_PRUNING_DAYS = 14;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await prisma.user.deleteMany({
    where: {
      email: { startsWith: "guest_", endsWith: "@guest.local" },
      createdAt: { lt: cutoff },
      sessions: { none: { expiresAt: { gt: new Date() } } },
    },
  });

  const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_PRUNING_DAYS * 24 * 60 * 60 * 1000);
  const pruned = await prisma.rateLimit.deleteMany({
    where: { updatedAt: { lt: rateLimitCutoff } },
  });

  return new Response(JSON.stringify({ deleted: result.count, retentionDays: RETENTION_DAYS, rateLimitsPruned: pruned.count }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
