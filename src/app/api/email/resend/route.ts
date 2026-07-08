import { requireUser } from "@/lib/auth";
import { error, json, handleRouteError } from "@/lib/http";
import { rateLimitShared, clientIp } from "@/lib/rate-limit";
import { issueEmailVerification } from "@/lib/verification";

export const runtime = "nodejs";

// Resends the verification email to the signed-in user (if not already verified).
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.emailVerified) return json({ ok: true, alreadyVerified: true });

    const rl = await rateLimitShared(`verify:resend:${clientIp(request)}`, 5, 3600);
    if (!rl.ok) return error(`Too many requests — try again in ${rl.retryAfter}s`, 429);
    const rlUser = await rateLimitShared(`verify:resend:user:${user.id}`, 5, 3600);
    if (!rlUser.ok) return error(`Too many requests — try again in ${rlUser.retryAfter}s`, 429);

    await issueEmailVerification(user.id, user.email);
    return json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
