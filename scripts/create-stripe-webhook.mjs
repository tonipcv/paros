import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
const url = process.env.STRIPE_WEBHOOK_URL;

if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}

if (!url || !/^https:\/\//.test(url)) {
  console.error("STRIPE_WEBHOOK_URL must be a public https URL, e.g. https://app.example.com/api/stripe/webhook");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });

const enabled_events = [
  "checkout.session.completed",
  "invoice.payment_succeeded",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

const endpoint = await stripe.webhookEndpoints.create({
  url,
  enabled_events,
  metadata: {
    app: "KRX",
    route: "/api/stripe/webhook",
    mode: secretKey.startsWith("sk_test_") ? "test" : "live",
  },
});

console.log(`STRIPE_WEBHOOK_ENDPOINT_ID=${endpoint.id}`);
console.log(`STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
console.log(`STRIPE_WEBHOOK_URL=${endpoint.url}`);
