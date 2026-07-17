import { prisma } from "@/lib/prisma";
import { hashToken, hashPassword } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { sendPasswordChangedEmail } from "@/lib/emails";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "");
    const password = String(body.password || "");
    if (!token) return error("Invalid or missing token");
    if (password.length < 8) return error("Password must be at least 8 characters");

    const ip = clientIp(request);
    const rl = await rateLimitShared(`pwreset:confirm:${ip}`, 20, 3600);
    if (!rl.ok) return error(`Too many attempts. Try again in ${rl.retryAfter}s`, 429);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { email: true } } },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return error("This reset link is invalid or has expired.", 400);
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { password: hashPassword(password) } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalidate any other outstanding reset tokens and all sessions for this user.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    // Security confirmation (best-effort).
    if (record.user?.email) {
      sendPasswordChangedEmail(record.user.email).catch((e) => console.error("password changed email failed:", e));
    }

    return json({ ok: true });
  } catch (e: unknown) {
    console.error("password reset error:", e);
    return error("Could not reset password", 500);
  }
}
