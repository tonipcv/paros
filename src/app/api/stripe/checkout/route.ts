import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { error, json } from "@/lib/http";
import { hasStripe, stripe } from "@/lib/stripe";
import { PLANS } from "@/lib/models";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);
    if (!hasStripe()) return error("Billing não configurado (STRIPE_SECRET_KEY ausente)", 503);

    const body = await request.json();
    const plan = PLANS.find((p) => p.id === body.plan && p.priceEnv);
    if (!plan) return error("Invalid plan");
    const billingCycle = body.billingCycle === "yearly" ? "yearly" : "monthly";
    const priceEnv = billingCycle === "yearly" ? `${plan.priceEnv}_YEARLY` : plan.priceEnv!;
    const priceId = process.env[priceEnv];
    if (!priceId) return error(`Price id ${priceEnv} não configurado`, 503);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3014";
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      metadata: { workspaceId: ws.id, plan: plan.id, billingCycle },
      success_url: `${appUrl}/billing?success=1`,
      cancel_url: `${appUrl}/billing?canceled=1`,
    });
    return json({ url: session.url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return error(message, 500);
  }
}
