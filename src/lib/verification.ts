import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { hashToken } from "./auth";
import { appUrl } from "./email";
import { sendVerifyEmail } from "./emails";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Issues an email-verification token and sends the verification email.
// Best-effort: never throws to the caller's critical path.
export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  try {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
    const link = `${appUrl()}/api/email/verify?token=${rawToken}`;
    const result = await sendVerifyEmail(email, link);
    if (result?.skipped && process.env.NODE_ENV !== "production") {
      console.log(`[dev] email verification link for ${email}: ${link}`);
    }
  } catch (e) {
    console.error("issueEmailVerification failed:", e);
  }
}
