import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { error, json } from "@/lib/http";
import { hasStripe, stripe } from "@/lib/stripe";
import { findPlan, PLANS, type BillingCycle } from "@/lib/models";
import { rateLimitShared } from "@/lib/rate-limit";

function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    const originHost = new URL(origin).host;
    return originHost === host || !!(appUrl && originHost === new URL(appUrl).host);
  } catch {
    return false;
  }
}

function validateBody(body: unknown): { plan: string; billingCycle: BillingCycle } | null {
  if (!body || typeof body !== "object") return null;
  const value = body as { plan?: unknown; billingCycle?: unknown };
  if (typeof value.plan !== "string") return null;
  const plan = PLANS.find((p) => p.id === value.plan && p.priceEnv);
  if (!plan) return null;
  const billingCycle: BillingCycle = value.billingCycle === "yearly" ? "yearly" : "monthly";
  return { plan: plan.id, billingCycle };
}

export async function POST(request: Request) {
  // CSRF protection
  if (!checkOrigin(request)) {
    return error("Invalid origin", 403);
  }

  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasStripe()) return error("Billing is not configured (STRIPE_SECRET_KEY missing)", 503);

    // Rate limit: 5 checkout sessions per minute per user
    const rl = await rateLimitShared(`checkout:${user.id}`, 5, 60);
    if (!rl.ok) {
      return error(`Rate limited. Try again in ${rl.retryAfter}s`, 429);
    }

    const body = await request.json().catch(() => null);
    const parsed = validateBody(body);
    if (!parsed) return error("Invalid plan or billing cycle");

    const plan = findPlan(parsed.plan)!;
    const priceEnv =
      parsed.billingCycle === "yearly" && plan.priceEnvYearly && process.env[plan.priceEnvYearly]
        ? plan.priceEnvYearly
        : plan.priceEnv!;
    const priceId = process.env[priceEnv];
    if (!priceId) return error(`Price id ${priceEnv} is not configured`, 503);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      metadata: { workspaceId: ws.id, plan: plan.id, billingCycle: parsed.billingCycle, priceId },
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?canceled=1`,
    });
    return json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return error(message, 500);
  }
}
