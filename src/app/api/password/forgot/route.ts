import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { sendEmail, emailLayout, button, paragraph, muted, appUrl } from "@/lib/email";

export const runtime = "nodejs";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!isEmail(body.email)) return error("Valid email required");
    const email = String(body.email).toLowerCase();

    const ip = clientIp(request);
    const ipLimit = await rateLimitShared(`pwreset:ip:${ip}`, 10, 3600);
    if (!ipLimit.ok) return error(`Too many requests — try again in ${ipLimit.retryAfter}s`, 429);
    const acctLimit = await rateLimitShared(`pwreset:acct:${email}`, 5, 3600);
    if (!acctLimit.ok) return error(`Too many requests — try again in ${acctLimit.retryAfter}s`, 429);

    const human = await verifyTurnstile(body.turnstileToken, request);
    if (!human.ok) return error(human.error, 400);

    const user = await prisma.user.findUnique({ where: { email } });
    // Only real, password-based accounts get a reset link; OAuth-only users don't.
    if (user && user.password) {
      const rawToken = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      });
      const link = `${appUrl()}/reset?token=${rawToken}`;
      const result = await sendEmail({
        to: email,
        subject: "Reset your password",
        html: emailLayout({
          title: "Reset your password",
          preheader: "Use this link to set a new password. It expires in 1 hour.",
          bodyHtml:
            paragraph("We received a request to reset the password for your account. Click the button below to choose a new one. This link expires in <b>1 hour</b> and can be used once.") +
            `<p style="margin:0 0 22px;">${button(link, "Reset password")}</p>` +
            muted(`If the button doesn't work, paste this link into your browser:<br>${link}`),
          footer: "If you didn't request a password reset, you can safely ignore this email — your password won't change.",
        }),
        text: `Reset your password (expires in 1 hour):\n${link}\n\nIf you didn't request this, ignore this email.`,
      }).catch((e) => {
        console.error("password reset email failed:", e);
        return { ok: false as const };
      });
      if (result && "skipped" in result && result.skipped && process.env.NODE_ENV !== "production") {
        console.log(`[dev] password reset link for ${email}: ${link}`);
      }
    }

    // Never reveal whether the email exists.
    return json({ ok: true });
  } catch (e: unknown) {
    console.error("password forgot error:", e);
    return json({ ok: true });
  }
}
