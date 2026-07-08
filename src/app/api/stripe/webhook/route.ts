import { prisma } from "@/lib/prisma";
import { hasStripe, stripe } from "@/lib/stripe";
import { findPlan, PLANS, type BillingCycle, type PlanConfig } from "@/lib/models";
import {
  sendPaymentConfirmedEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCanceledEmail,
} from "@/lib/emails";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function workspaceEmail(workspaceId: string): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { user: { select: { email: true } } },
  });
  return ws?.user?.email ?? null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
}

function planForPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  for (const plan of PLANS) {
    if (plan.priceEnv && process.env[plan.priceEnv] === priceId) return plan;
    if (plan.priceEnvYearly && process.env[plan.priceEnvYearly] === priceId) return plan;
  }
  return null;
}

function envPriceId(plan: PlanConfig, billingCycle: BillingCycle) {
  const envName =
    billingCycle === "yearly" && plan.priceEnvYearly && process.env[plan.priceEnvYearly]
      ? plan.priceEnvYearly
      : plan.priceEnv;
  return envName ? process.env[envName] ?? null : null;
}

function checkoutPriceId(session: Stripe.Checkout.Session, plan: PlanConfig) {
  const metadataPriceId = session.metadata?.priceId;
  if (metadataPriceId && planForPriceId(metadataPriceId)?.id === plan.id) return metadataPriceId;
  const billingCycle: BillingCycle = session.metadata?.billingCycle === "yearly" ? "yearly" : "monthly";
  return envPriceId(plan, billingCycle);
}

// Reserve event processing. FAILED events are retried; PROCESSING/PROCESSED duplicates are skipped.
async function beginEvent(id: string, type: string): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({ data: { id, type, status: "PROCESSING" } });
    return true;
  } catch (error: unknown) {
    if (prismaErrorCode(error) !== "P2002") throw error;
    const existing = await prisma.stripeEvent.findUnique({ where: { id } });
    if (existing?.status !== "FAILED") return false;
    await prisma.stripeEvent.update({
      where: { id },
      data: { type, status: "PROCESSING", error: null },
    });
    return true;
  }
}

async function completeEvent(id: string) {
  await prisma.stripeEvent.update({
    where: { id },
    data: { status: "PROCESSED", error: null, processedAt: new Date() },
  });
}

async function failEvent(id: string, error: unknown) {
  await prisma.stripeEvent.update({
    where: { id },
    data: { status: "FAILED", error: errorMessage(error) },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  if (invoice.billing_reason !== "subscription_cycle") return;
  // Idempotency per invoice: Stripe may deliver both invoice.paid and
  // invoice.payment_succeeded (distinct event ids) for the same invoice.
  // Guard on the invoice id so a renewal only ever grants credits once.
  try {
    await prisma.stripeEvent.create({
      data: { id: `invoice_cycle:${invoice.id}`, type: "invoice.cycle", status: "PROCESSED", processedAt: new Date() },
    });
  } catch (error: unknown) {
    if (prismaErrorCode(error) === "P2002") return; // already credited
    throw error;
  }
  const sub = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  if (!sub) return;
  const p = planForPriceId(sub.stripePriceId);
  if (!p) return;
  await prisma.workspace.update({
    where: { id: sub.workspaceId },
    data: { credits: { increment: p.credits } },
  });
}

export async function POST(request: Request) {
  if (!hasStripe() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Stripe not configured", { status: 503 });
  }
  const sig = request.headers.get("stripe-signature") || "";
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const shouldProcess = await beginEvent(event.id, event.type);
  if (!shouldProcess) return new Response("ok", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        const plan = findPlan(session.metadata?.plan);
        if (workspaceId && plan) {
          const priceId = checkoutPriceId(session, plan);
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: { plan: plan.id, credits: { increment: plan.credits } },
          });
          await prisma.subscription.upsert({
            where: { workspaceId },
            create: {
              workspaceId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripePriceId: priceId,
              status: "ACTIVE",
            },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              stripePriceId: priceId,
              status: "ACTIVE",
            },
          });
          const cycle: BillingCycle = session.metadata?.billingCycle === "yearly" ? "yearly" : "monthly";
          const to = await workspaceEmail(workspaceId);
          if (to) {
            await sendPaymentConfirmedEmail(to, { planName: plan.name, credits: plan.credits, cycle }).catch((e) =>
              console.error("payment confirmed email failed:", e)
            );
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
        });
        if (sub) {
          const plan = planForPriceId(sub.stripePriceId);
          const to = await workspaceEmail(sub.workspaceId);
          if (to) {
            await sendPaymentFailedEmail(to, { planName: plan?.name }).catch((e) =>
              console.error("payment failed email failed:", e)
            );
          }
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
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
              data: { plan: plan.id },
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: "CANCELED", cancelAtPeriodEnd: false },
          });
          const freePlan = PLANS.find((p) => p.id === "FREE");
          // Set credits to FREE tier cap, but never reduce if user already has fewer
          const cap = freePlan?.credits ?? 10;
          const ws = await prisma.workspace.findUnique({ where: { id: sub.workspaceId }, select: { credits: true } });
          const target = ws ? Math.min(ws.credits, cap) : cap;
          await prisma.workspace.update({
            where: { id: sub.workspaceId },
            data: { plan: "FREE", credits: target },
          });
          const to = await workspaceEmail(sub.workspaceId);
          if (to) {
            await sendSubscriptionCanceledEmail(to).catch((e) =>
              console.error("subscription canceled email failed:", e)
            );
          }
        }
        break;
      }
    }
    await completeEvent(event.id);
  } catch (e) {
    console.error("Webhook handler error:", e);
    await failEvent(event.id, e).catch((failError) => console.error("StripeEvent failure update error:", failError));
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
