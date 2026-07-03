import { createUserWithWorkspace } from "@/lib/account";
import { createSession, setSessionCookie } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = body.email;
    const password = String(body.password || "");
    if (!isEmail(email)) return error("Valid email required");
    if (password.length < 6) return error("Password must be at least 6 characters");
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);

    const user = await createUserWithWorkspace({ name, email, password });
    const token = await createSession(user.id);
    await setSessionCookie(token);
    return json({ ok: true });
  } catch (e: any) {
    return error(e.message || "Signup failed", 400);
  }
}
