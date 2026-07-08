import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie, verifyPasswordHash } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { sendNewSignInEmail } from "@/lib/emails";

export const runtime = "nodejs";

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

    // Security: alert on a sign-in from a new IP (deduped to ~once per 30 days).
    const firstFromIp = await rateLimitShared(`signin:${user.id}:${ip}`, 1, 30 * 24 * 3600);
    if (firstFromIp.ok) {
      const ua = request.headers.get("user-agent")?.slice(0, 160) || undefined;
      sendNewSignInEmail(user.email, { ip: ip === "unknown" ? undefined : ip, userAgent: ua }).catch((e) =>
        console.error("new sign-in email failed:", e)
      );
    }

    return json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Login failed";
    return error(message, 401);
  }
}
