import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie, verifyPasswordHash } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isEmail(body.email)) return error("Valid email required");
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);
    const user = await prisma.user.findUnique({ where: { email: String(body.email).toLowerCase() } });
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
