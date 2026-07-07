import { createGuestUser } from "@/lib/account";
import { createSession, setSessionCookie } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    // Abuse control: a few guest accounts per IP per hour.
    const rl = await rateLimitShared(`guest:${ip}`, 3, 3600);
    if (!rl.ok) return error("Too many guest sessions. Please create an account.", 429);

    const body = await request.json().catch(() => ({}));
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);

    const user = await createGuestUser();
    const token = await createSession(user.id);
    await setSessionCookie(token);
    return json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Guest session failed";
    return error(message, 500);
  }
}
