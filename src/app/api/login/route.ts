import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie, verifyPasswordHash } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isEmail(body.email)) return error("Valid email required");
    const email = String(body.email).toLowerCase();
    // Brute-force protection: cap attempts per IP and per targeted account.
    const ip = clientIp(request);
    const ipLimit = await rateLimitShared(`login:ip:${ip}`, 20, 300);
    if (!ipLimit.ok) return error(`Too many attempts — try again in ${ipLimit.retryAfter}s`, 429);
    const acctLimit = await rateLimitShared(`login:acct:${email}`, 10, 300);
    if (!acctLimit.ok) return error(`Too many attempts — try again in ${acctLimit.retryAfter}s`, 429);
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password || !verifyPasswordHash(String(body.password || ""), user.password)) {
      return error("Invalid email or password", 401);
    }
    const token = await createSession(user.id);
    await setSessionCookie(token);
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message || "Login failed", 401);
  }
}
