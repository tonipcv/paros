import { createUserWithWorkspace } from "@/lib/account";
import { createSession, setSessionCookie } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/emails";
import { issueEmailVerification } from "@/lib/verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = body.email;
    const password = String(body.password || "");
    if (!isEmail(email)) return error("Valid email required");
    if (password.length < 8) return error("Password must be at least 8 characters");
    const ip = clientIp(request);
    const rl = await rateLimitShared(`signup:ip:${ip}`, 5, 3600);
    if (!rl.ok) return error(`Too many sign-ups. Try again in ${rl.retryAfter}s`, 429);
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);

    const user = await createUserWithWorkspace({ name, email, password });
    const token = await createSession(user.id);
    await setSessionCookie(token);

    sendWelcomeEmail(String(email).toLowerCase(), name).catch((e) => console.error("welcome email failed:", e));
    issueEmailVerification(user.id, String(email).toLowerCase()).catch((e) => console.error("verify email failed:", e));

    return json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Signup failed";
    return error(message, 400);
  }
}
