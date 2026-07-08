import { requireUser } from "@/lib/auth";
import { getWorkspaceForUser } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { stripe, hasStripe } from "@/lib/stripe";
import { findPlan } from "@/lib/models";
import { error, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const ws = await getWorkspaceForUser(user.id);
    if (!ws) return error("Workspace not found", 404);

    const sub = await prisma.subscription.findUnique({ where: { workspaceId: ws.id } });
    if (!sub || !hasStripe()) {
      return json({ subscription: null, invoices: [] });
    }

    const [stripeSub, invoices] = await Promise.all([
      sub.stripeSubscriptionId
        ? stripe()
            .subscriptions.retrieve(sub.stripeSubscriptionId)
            .catch(() => null)
        : null,
      sub.stripeCustomerId
        ? stripe()
            .invoices.list({ customer: sub.stripeCustomerId, limit: 24 })
            .then((r) => r.data)
            .catch(() => [])
        : [],
    ]);

    const plan = findPlan(ws.plan);
    const currentPeriodEnd = stripeSub?.current_period_end
      ? new Date(stripeSub.current_period_end * 1000).toISOString()
      : sub.currentPeriodEnd?.toISOString() ?? null;

    return json({
      subscription: {
        status: stripeSub?.status ?? sub.status,
        plan: plan?.name ?? ws.plan,
        credits: plan?.credits ?? 0,
        currentPeriodEnd,
        cancelAtPeriodEnd: stripeSub?.cancel_at_period_end ?? sub.cancelAtPeriodEnd,
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        periodStart: new Date(inv.period_start * 1000).toISOString(),
        periodEnd: new Date(inv.period_end * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return error(message, 500);
  }
}
