import { createUserWithWorkspace } from "@/lib/account";
import { createSession, setSessionCookie } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { sendEmail, emailLayout, button, paragraph, appUrl } from "@/lib/email";

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
    if (!rl.ok) return error(`Too many sign-ups — try again in ${rl.retryAfter}s`, 429);
    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);

    const user = await createUserWithWorkspace({ name, email, password });
    const token = await createSession(user.id);
    await setSessionCookie(token);

    // Welcome email (best-effort; never blocks signup).
    sendEmail({
      to: String(email).toLowerCase(),
      subject: "Welcome to KRX",
      html: emailLayout({
        title: `Welcome to KRX${name ? `, ${name}` : ""}`,
        preheader: "Your private AI workspace is ready.",
        bodyHtml:
          paragraph("Your private AI workspace is ready. Chat with frontier and open models, generate images, and pick your privacy mode — from zero-retention to hardware-attested TEE and real end-to-end encryption.") +
          `<p style="margin:0 0 8px;">${button(`${appUrl()}/chat`, "Open your workspace")}</p>`,
        footer: "You're receiving this because you created a KRX account.",
      }),
      text: `Welcome to KRX. Open your workspace: ${appUrl()}/chat`,
    }).catch((e) => console.error("welcome email failed:", e));

    return json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Signup failed";
    return error(message, 400);
  }
}
