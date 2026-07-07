import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { error, isEmail, json } from "@/lib/http";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { sendEmail, emailLayout, button, appUrl } from "@/lib/email";

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
          bodyHtml: `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#c8c8c8;">
              We received a request to reset your password. This link expires in 1 hour and can be used once.
            </p>
            <p style="margin:0 0 20px;">${button(link, "Reset password")}</p>
            <p style="margin:0;font-size:12px;color:#8a8a8a;word-break:break-all;">Or paste this link: ${link}</p>`,
        }),
        text: `Reset your password (expires in 1 hour): ${link}`,
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
