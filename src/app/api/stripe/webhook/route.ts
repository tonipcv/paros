import { prisma } from "@/lib/prisma";
import { hasStripe, stripe } from "@/lib/stripe";
import { PLANS } from "@/lib/models";

export const runtime = "nodejs";

function planForPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  // Check both monthly (STRIPE_PRICE_*) and yearly (STRIPE_PRICE_*_YEARLY) env vars
  for (const plan of PLANS) {
    if (plan.priceEnv && process.env[plan.priceEnv] === priceId) return plan;
    if (plan.priceEnvYearly && process.env[plan.priceEnvYearly] === priceId) return plan;
  }
  return null;
}

export async function POST(request: Request) {
  if (!hasStripe() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe not configured", { status: 503 });
  }
  const sig = request.headers.get("stripe-signature") || "";
  const raw = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    return new Response(`Webhook error: ${e.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const workspaceId = session.metadata?.workspaceId;
        const plan = PLANS.find((p) => p.id === session.metadata?.plan);
        if (workspaceId && plan) {
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: { plan: plan.id as any, credits: { increment: plan.credits } },
          });
          await prisma.subscription.upsert({
            where: { workspaceId },
            create: {
              workspaceId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripePriceId: plan.priceEnv ? process.env[plan.priceEnv] : null,
              status: "ACTIVE",
            },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripePriceId: plan.priceEnv ? process.env[plan.priceEnv] : null,
              status: "ACTIVE",
            },
          });
        }
        break;
      }

      case "invoice.paid": {
        // Monthly renewal — top up credits for the active plan
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string;
        const billingReason = invoice.billing_reason;
        if (billingReason === "subscription_cycle") {
          const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
          if (sub) {
            const plan = planForPriceId(sub.stripePriceId);
            if (plan) {
              await prisma.workspace.update({
                where: { id: sub.workspaceId },
                data: { credits: { increment: plan.credits } },
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = planForPriceId(priceId);
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              stripePriceId: priceId,
              status: subscription.status === "active" ? "ACTIVE" : subscription.status === "past_due" ? "PAST_DUE" : "CANCELED",
              cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
          if (plan && subscription.status === "active") {
            await prisma.workspace.update({
              where: { id: sub.workspaceId },
              data: { plan: plan.id as any },
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "CANCELED", cancelAtPeriodEnd: false },
          });
          await prisma.workspace.update({
            where: { id: sub.workspaceId },
            data: { plan: "FREE" },
          });
        }
        break;
      }
    }
  } catch (e: any) {
    return new Response(`Handler error: ${e.message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
