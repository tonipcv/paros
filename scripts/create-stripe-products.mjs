import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

const tiers = [
  { plan: "STARTER", name: "KRX — Pro", amount: 1800, yearlyAmount: 19440, credits: 100 },
  { plan: "PRO", name: "KRX — Pro+", amount: 6800, yearlyAmount: 73440, credits: 500 },
  { plan: "MAX", name: "KRX — Max", amount: 20000, yearlyAmount: 216000, credits: 2500 },
];

async function main() {
  const results = {};
  for (const t of tiers) {
    const product = await stripe.products.create({
      name: t.name,
      description: `${t.credits.toLocaleString()} credits / month`,
      metadata: { app: "KRX", plan: t.plan, credits: String(t.credits) },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: t.amount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan: t.plan },
    });

    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: t.yearlyAmount,
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { plan: t.plan },
    });

    results[t.plan] = { monthly: price.id, yearly: yearlyPrice.id };
    console.log(`${t.plan}: product=${product.id} monthly=${price.id} yearly=${yearlyPrice.id}`);
  }
  console.log("\n---ENV---");
  console.log(`STRIPE_PRICE_STARTER=${results.STARTER.monthly}`);
  console.log(`STRIPE_PRICE_STARTER_YEARLY=${results.STARTER.yearly}`);
  console.log(`STRIPE_PRICE_PRO=${results.PRO.monthly}`);
  console.log(`STRIPE_PRICE_PRO_YEARLY=${results.PRO.yearly}`);
  console.log(`STRIPE_PRICE_MAX=${results.MAX.monthly}`);
  console.log(`STRIPE_PRICE_MAX_YEARLY=${results.MAX.yearly}`);
}

main().catch((e) => {
  console.error("Stripe error:", e.message);
  process.exit(1);
});
