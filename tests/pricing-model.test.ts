import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { annualMonthlyEquivalent, annualPlanPrice, findPlan, formatPrice, PLANS, YEARLY_DISCOUNT } from "../src/lib/models";
import { rateLimit } from "../src/lib/rate-limit";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function activeEnvKeys(path: string) {
  return new Set(
    read(path)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=")[0])
  );
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("plans match the canonical pricing model", () => {
  assert.deepEqual(
    PLANS.map((plan) => ({ id: plan.id, name: plan.name, price: plan.price, credits: plan.credits })),
    [
      { id: "FREE", name: "Free", price: 0, credits: 10 },
      { id: "STARTER", name: "Pro", price: 18, credits: 100 },
      { id: "PRO", name: "Pro+", price: 68, credits: 500 },
      { id: "MAX", name: "Max", price: 200, credits: 2500 },
    ]
  );
});

test("annual pricing is exactly 10 percent off", () => {
  assert.equal(YEARLY_DISCOUNT, 0.9);
  assert.equal(annualPlanPrice(18), 194.4);
  assert.equal(annualPlanPrice(68), 734.4);
  assert.equal(annualPlanPrice(200), 2160);
  assert.equal(annualMonthlyEquivalent(18), 194.4 / 12);
  assert.equal(annualMonthlyEquivalent(68), 734.4 / 12);
  assert.equal(annualMonthlyEquivalent(200), 2160 / 12);
  assert.equal(formatPrice(annualMonthlyEquivalent(18)), "16.20");
  assert.equal(formatPrice(annualMonthlyEquivalent(68)), "61.20");
  assert.equal(formatPrice(annualMonthlyEquivalent(200)), "180");
});

test("Stripe product creation script matches PLANS", () => {
  const script = read("scripts/create-stripe-products.mjs");
  for (const expected of [
    "amount: 1800",
    "yearlyAmount: 19440",
    "credits: 100",
    "amount: 6800",
    "yearlyAmount: 73440",
    "credits: 500",
    "amount: 20000",
    "yearlyAmount: 216000",
    "credits: 2500",
  ]) {
    assert.ok(script.includes(expected), `missing ${expected}`);
  }
});

test("environment templates include all Stripe price keys", () => {
  const keys = activeEnvKeys(".env.example");
  for (const key of [
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_PRO",
    "STRIPE_PRICE_MAX",
    "STRIPE_PRICE_STARTER_YEARLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_PRICE_MAX_YEARLY",
    "NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY",
    "NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY",
    "NEXT_PUBLIC_STRIPE_PRICE_MAX_YEARLY",
  ]) {
    assert.ok(keys.has(key), `missing ${key}`);
  }
});

test("user-facing credit copy does not advertise stale 500-credit free signup", () => {
  assert.equal(findPlan("FREE")?.credits, 10);
  assert.ok(!read("src/app/signup/page.tsx").includes("500 free credits"));
  assert.ok(!read("prisma/seed.ts").includes("credits: 500"));
});

test("landing pricing copy is derived from canonical plan credits", () => {
  const landing = read("src/components/landing-pricing.tsx");
  assert.ok(landing.includes("formatCredits(credits)"));
  assert.ok(!landing.includes("7,500 credits / month"));
  assert.ok(!landing.includes("22,500 credits / month"));
});

test("checkout validates plans server-side and stores selected price id metadata", () => {
  const checkout = read("src/app/api/stripe/checkout/route.ts");
  assert.ok(checkout.includes("PLANS.find"));
  assert.ok(checkout.includes("priceId"));
  assert.ok(checkout.includes("metadata: { workspaceId: ws.id, plan: plan.id, billingCycle: parsed.billingCycle, priceId }"));
  assert.ok(!checkout.includes("body.price"));
});

test("checkout rate limit rejects the sixth request in one minute", () => {
  const key = `pricing-test-${Date.now()}`;
  for (let index = 0; index < 5; index += 1) {
    assert.equal(rateLimit(key, 5, 5 / 60).ok, true);
  }
  assert.equal(rateLimit(key, 5, 5 / 60).ok, false);
});

test("webhook idempotency supports failed-event retry and processed-event skip", () => {
  const webhook = read("src/app/api/stripe/webhook/route.ts");
  assert.ok(webhook.includes("status: \"PROCESSING\""));
  assert.ok(webhook.includes("existing?.status !== \"FAILED\""));
  assert.ok(webhook.includes("status: \"PROCESSED\""));
  assert.ok(webhook.includes("status: \"FAILED\""));
});

test("webhook persists actual monthly or yearly checkout price id", () => {
  const webhook = read("src/app/api/stripe/webhook/route.ts");
  assert.ok(webhook.includes("metadataPriceId"));
  assert.ok(webhook.includes("checkoutPriceId(session, plan)"));
  assert.ok(webhook.includes("stripePriceId: priceId"));
  assert.ok(webhook.includes("invoice.payment_succeeded"));
});

test("subscription deletion downgrades to FREE and caps credits", () => {
  const webhook = read("src/app/api/stripe/webhook/route.ts");
  assert.ok(webhook.includes("Math.min(ws.credits, cap)"));
  assert.ok(webhook.includes("data: { plan: \"FREE\", credits: target }"));
});

test("StripeEvent migration exists and is deploy-safe", () => {
  const migration = read("prisma/migrations/20260707120000_add_stripe_events/migration.sql");
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS \"stripe_events\""));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS \"status\""));
});
