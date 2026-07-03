type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

const CAPACITY = 60; // burst
const REFILL_PER_SEC = 1; // 60 req/min sustained

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
