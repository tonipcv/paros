import { prisma } from "./prisma";

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

const CAPACITY = 60; // burst
const REFILL_PER_SEC = 1; // 60 req/min sustained

// In-memory token bucket. NOTE: per-instance only — used as a local fallback
// when the shared (Postgres) limiter is unavailable. Not reliable on its own
// in a serverless/multi-instance deployment.
export function rateLimit(key: string, capacity = CAPACITY, refillPerSec = REFILL_PER_SEC) {
  const now = Date.now();
  const b = buckets.get(key) || { tokens: capacity, updatedAt: now };
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
  b.updatedAt = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / refillPerSec) };
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true, remaining: Math.floor(b.tokens) };
}

export type RateLimitResult = { ok: boolean; retryAfter?: number; remaining?: number };

// Shared, cross-instance rate limiter backed by Postgres (fixed window).
// A single atomic upsert increments the current window's counter and returns
// the new count, so it is correct across serverless instances/regions.
// Falls back to the in-memory limiter if the database is unreachable.
export async function rateLimitShared(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const windowMs = windowSec * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limits" ("key", "count", "windowStart", "updatedAt")
      VALUES (${key}, 1, ${windowStart}, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."windowStart" = ${windowStart}
                       THEN "rate_limits"."count" + 1 ELSE 1 END,
        "windowStart" = ${windowStart},
        "updatedAt" = NOW()
      RETURNING "count";
    `;
    const count = Number(rows[0]?.count ?? 1);
    if (count > limit) {
      return { ok: false, retryAfter: Math.ceil((windowMs - (now % windowMs)) / 1000) };
    }
    return { ok: true, remaining: Math.max(0, limit - count) };
  } catch (e) {
    console.error("rateLimitShared DB error — falling back to in-memory:", e);
    return rateLimit(key, limit, limit / windowSec);
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
