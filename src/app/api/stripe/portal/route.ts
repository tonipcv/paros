import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { error, json } from "@/lib/http";
import { hasStripe, stripe } from "@/lib/stripe";
import { rateLimitShared } from "@/lib/rate-limit";

function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;
  try {
    return new URL(origin).host === new URL(appUrl).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!checkOrigin(request)) return error("Invalid origin", 403);

  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasStripe()) return error("Billing is not configured", 503);

    // Rate limit: 10 portal opens per minute per user
    const rl = await rateLimitShared(`portal:${user.id}`, 10, 60);
    if (!rl.ok) return error(`Rate limited. Try again in ${rl.retryAfter}s`, 429);

    const sub = await prisma.subscription.findUnique({ where: { workspaceId: ws.id } });
    if (!sub?.stripeCustomerId) return error("No active subscription", 400);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
    const session = await stripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    });
    return json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Portal failed";
    return error(message, 500);
  }
}
