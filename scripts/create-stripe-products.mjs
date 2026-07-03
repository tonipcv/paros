import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

const tiers = [
  { plan: "STARTER", name: "HTPS.io — Starter", amount: 900, credits: 5000 },
  { plan: "PRO", name: "HTPS.io — Pro", amount: 2900, credits: 25000 },
  { plan: "MAX", name: "HTPS.io — Max", amount: 9900, credits: 120000 },
];

async function main() {
  const results = {};
  for (const t of tiers) {
    const product = await stripe.products.create({
      name: t.name,
      description: `${t.credits.toLocaleString()} credits / month`,
      metadata: { app: "HTPS.io", plan: t.plan, credits: String(t.credits) },
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: t.amount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan: t.plan },
    });
    results[t.plan] = price.id;
    console.log(`${t.plan}: product=${product.id} price=${price.id}`);
  }
  console.log("\n---ENV---");
  console.log(`STRIPE_PRICE_STARTER=${results.STARTER}`);
  console.log(`STRIPE_PRICE_PRO=${results.PRO}`);
  console.log(`STRIPE_PRICE_MAX=${results.MAX}`);
}

main().catch((e) => {
  console.error("Stripe error:", e.message);
  process.exit(1);
});
