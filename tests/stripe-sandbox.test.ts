import assert from "node:assert/strict";
import Stripe from "stripe";
import { annualPlanPrice, paidPlans } from "../src/lib/models";

const stripeSecretKey = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "";
const apiVersion = "2025-02-24.acacia";

function requireSandbox() {
  assert.ok(stripeSecretKey.startsWith("sk_test_"), "Stripe sandbox tests require STRIPE_TEST_SECRET_KEY or STRIPE_SECRET_KEY with sk_test_");
  assert.ok(webhookSecret.startsWith("whsec_"), "Stripe sandbox tests require STRIPE_TEST_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET");
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function main() {
  requireSandbox();
  const stripe = new Stripe(stripeSecretKey, { apiVersion });
  const createdProducts: string[] = [];

  try {
    await test("Stripe key is test mode", async () => {
      const balance = await stripe.balance.retrieve();
      assert.ok(Array.isArray(balance.available));
    });

    const pricesByPlan = new Map<string, { monthly: Stripe.Price; yearly: Stripe.Price }>();

    await test("creates test-mode products and prices matching PLANS", async () => {
      for (const plan of paidPlans()) {
        const product = await stripe.products.create({
          name: `KRX sandbox ${plan.id} ${Date.now()}`,
          description: `${plan.credits.toLocaleString("en-US")} credits / month`,
          metadata: { app: "KRX", plan: plan.id, sandbox: "true" },
        });
        createdProducts.push(product.id);

        const monthly = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.price * 100,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { plan: plan.id, sandbox: "true", billingCycle: "monthly" },
        });
        const yearly = await stripe.prices.create({
          product: product.id,
          unit_amount: annualPlanPrice(plan.price) * 100,
          currency: "usd",
          recurring: { interval: "year" },
          metadata: { plan: plan.id, sandbox: "true", billingCycle: "yearly" },
        });

        assert.equal(monthly.unit_amount, plan.price * 100);
        assert.equal(monthly.recurring?.interval, "month");
        assert.equal(yearly.unit_amount, annualPlanPrice(plan.price) * 100);
        assert.equal(yearly.recurring?.interval, "year");
        pricesByPlan.set(plan.id, { monthly, yearly });
      }
      assert.equal(pricesByPlan.size, paidPlans().length);
    });

    await test("creates monthly and yearly Checkout Sessions with selected test prices", async () => {
      for (const plan of paidPlans()) {
        const prices = pricesByPlan.get(plan.id);
        assert.ok(prices, `missing prices for ${plan.id}`);
        for (const [billingCycle, price] of Object.entries(prices) as Array<["monthly" | "yearly", Stripe.Price]>) {
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            line_items: [{ price: price.id, quantity: 1 }],
            customer_email: `stripe-sandbox-${plan.id.toLowerCase()}-${billingCycle}@example.com`,
            metadata: { workspaceId: `sandbox-${plan.id}`, plan: plan.id, billingCycle, priceId: price.id },
            success_url: "https://example.com/billing?success=1",
            cancel_url: "https://example.com/billing?canceled=1",
          });
          assert.equal(session.mode, "subscription");
          assert.equal(session.metadata?.plan, plan.id);
          assert.equal(session.metadata?.billingCycle, billingCycle);
          assert.equal(session.metadata?.priceId, price.id);
        }
      }
    });

    await test("Stripe webhook signature round-trip works in sandbox", async () => {
      const payload = JSON.stringify({
        id: `evt_sandbox_${Date.now()}`,
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: `cs_test_${Date.now()}`,
            object: "checkout.session",
            metadata: { workspaceId: "sandbox-workspace", plan: "STARTER", billingCycle: "yearly" },
          },
        },
      });
      const header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
      const event = stripe.webhooks.constructEvent(payload, header, webhookSecret);
      assert.equal(event.type, "checkout.session.completed");
    });
  } finally {
    for (const productId of createdProducts) {
      await stripe.products.update(productId, { active: false }).catch((error) => {
        console.error(`cleanup failed for ${productId}:`, error);
      });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
