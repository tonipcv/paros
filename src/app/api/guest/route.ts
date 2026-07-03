import { createGuestUser } from "@/lib/account";
import { createSession, setSessionCookie } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    // Abuse control: a few guest accounts per IP, slow refill.
    const rl = rateLimit(`guest:${ip}`, 3, 0.0005);
    if (!rl.ok) return error("Too many guest sessions. Please create an account.", 429);

    const body = await request.json().catch(() => ({}));
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);

    const user = await createGuestUser();
    const token = await createSession(user.id);
    await setSessionCookie(token);
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message || "Guest session failed", 500);
  }
}
