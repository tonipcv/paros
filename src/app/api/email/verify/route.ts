import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { appUrl } from "@/lib/email";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET link from the verification email. Marks the account verified and redirects
// to a friendly result page. Never reveals token details.
export async function GET(request: Request) {
  const base = appUrl();
  const token = new URL(request.url).searchParams.get("token") || "";
  const fail = NextResponse.redirect(`${base}/verify?status=invalid`);
  if (!token) return fail;

  const ip = clientIp(request);
  const rl = await rateLimitShared(`verify:ip:${ip}`, 30, 3600);
  if (!rl.ok) return fail;

  try {
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) return fail;

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
      prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    return NextResponse.redirect(`${base}/verify?status=success`);
  } catch (e) {
    console.error("email verify error:", e);
    return fail;
  }
}
