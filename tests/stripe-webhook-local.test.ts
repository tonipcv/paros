import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";

const PORT = 3024;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WEBHOOK_SECRET = process.env.STRIPE_TEST_WEBHOOK_SECRET || "whsec_local_webhook_test_secret";
const STRIPE_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
const CLEANUP = process.env.CLEANUP_WEBHOOK_TEST_DATA === "true";
const CLEANUP_FILE = process.env.WEBHOOK_TEST_CLEANUP_FILE || ".stripe-webhook-local-cleanup.json";

const TEST_PRICE_IDS = {
  STARTER: {
    monthly: process.env.STRIPE_TEST_PRICE_STARTER || "price_1TqXfjDwF1El4knjDMq7CLif",
    yearly: process.env.STRIPE_TEST_PRICE_STARTER_YEARLY || "price_1TqXfjDwF1El4knjV7qJny3F",
  },
  PRO: {
    monthly: process.env.STRIPE_TEST_PRICE_PRO || "price_1TqXfkDwF1El4knjuruBhR5F",
    yearly: process.env.STRIPE_TEST_PRICE_PRO_YEARLY || "price_1TqXfkDwF1El4knj8L0N2HRO",
  },
  MAX: {
    monthly: process.env.STRIPE_TEST_PRICE_MAX || "price_1TqXflDwF1El4knjNkuYmsjV",
    yearly: process.env.STRIPE_TEST_PRICE_MAX_YEARLY || "price_1TqXflDwF1El4knjghUShL1X",
  },
};

function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  const file = readFileSync(".env", "utf8");
  for (const line of file.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function requireTestStripeKey() {
  assert.ok(STRIPE_SECRET_KEY.startsWith("sk_test_"), "Local webhook test requires STRIPE_TEST_SECRET_KEY or STRIPE_SECRET_KEY with sk_test_");
}

function serverEnv() {
  return {
    ...process.env,
    NEXT_PUBLIC_APP_URL: BASE_URL,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_STARTER: TEST_PRICE_IDS.STARTER.monthly,
    STRIPE_PRICE_STARTER_YEARLY: TEST_PRICE_IDS.STARTER.yearly,
    STRIPE_PRICE_PRO: TEST_PRICE_IDS.PRO.monthly,
    STRIPE_PRICE_PRO_YEARLY: TEST_PRICE_IDS.PRO.yearly,
    STRIPE_PRICE_MAX: TEST_PRICE_IDS.MAX.monthly,
    STRIPE_PRICE_MAX_YEARLY: TEST_PRICE_IDS.MAX.yearly,
    NEXT_PUBLIC_STRIPE_PRICE_STARTER_YEARLY: TEST_PRICE_IDS.STARTER.yearly,
    NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY: TEST_PRICE_IDS.PRO.yearly,
    NEXT_PUBLIC_STRIPE_PRICE_MAX_YEARLY: TEST_PRICE_IDS.MAX.yearly,
  };
}

function startServer() {
  const child = spawn("./node_modules/.bin/next", ["dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: process.cwd(),
    env: serverEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  return child;
}

async function waitForServer(child: ChildProcess) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next dev server exited with code ${child.exitCode}`);
    try {
      const res = await fetch(BASE_URL, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // Wait for the server socket to open.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next dev server did not become ready");
}

function signedWebhookRequest(stripe: Stripe, event: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
    body: payload,
  });
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function main() {
  loadDotEnv();
  requireTestStripeKey();
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for local webhook e2e");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" });

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `stripe-webhook-local-${suffix}@example.test`;
  const checkoutEventId = `evt_local_checkout_${suffix}`;
  const invoiceEventId = `evt_local_invoice_${suffix}`;
  const deleteEventId = `evt_local_delete_${suffix}`;
  const customerId = `cus_local_${suffix}`;
  const subscriptionId = `sub_local_${suffix}`;
  let workspaceId = "";
  let userId = "";
  let server: ChildProcess | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: "Stripe Webhook Local Test",
        workspace: { create: { name: "Stripe Webhook Local Test", plan: "FREE", credits: 10 } },
      },
      include: { workspace: true },
    });
    userId = user.id;
    workspaceId = user.workspace!.id;
    writeFileSync(
      CLEANUP_FILE,
      JSON.stringify(
        {
          email,
          userId,
          workspaceId,
          eventIds: [checkoutEventId, invoiceEventId, deleteEventId],
          customerId,
          subscriptionId,
        },
        null,
        2
      )
    );

    server = startServer();
    await waitForServer(server);

    await runTest("rejects invalid webhook signatures", async () => {
      const res = await signedWebhookRequest(
        stripe,
        { id: `evt_bad_${suffix}`, object: "event", type: "checkout.session.completed", data: { object: {} } },
        "whsec_wrong_secret"
      );
      assert.equal(res.status, 400);
      assert.equal(await res.text(), "Invalid webhook signature");
    });

    await runTest("checkout.session.completed upgrades workspace and stores yearly price", async () => {
      const res = await signedWebhookRequest(stripe, {
        id: checkoutEventId,
        object: "event",
        type: "checkout.session.completed",
        data: {
          object: {
            id: `cs_test_${suffix}`,
            object: "checkout.session",
            customer: customerId,
            subscription: subscriptionId,
            metadata: {
              workspaceId,
              plan: "STARTER",
              billingCycle: "yearly",
              priceId: TEST_PRICE_IDS.STARTER.yearly,
            },
          },
        },
      });
      assert.equal(res.status, 200);
      assert.equal(await res.text(), "ok");
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      const subscription = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId } });
      const event = await prisma.stripeEvent.findUniqueOrThrow({ where: { id: checkoutEventId } });
      assert.equal(workspace.plan, "STARTER");
      assert.equal(workspace.credits, 110);
      assert.equal(subscription.stripePriceId, TEST_PRICE_IDS.STARTER.yearly);
      assert.equal(subscription.status, "ACTIVE");
      assert.equal(event.status, "PROCESSED");
    });

    await runTest("duplicate checkout event is idempotent", async () => {
      const res = await signedWebhookRequest(stripe, {
        id: checkoutEventId,
        object: "event",
        type: "checkout.session.completed",
        data: { object: { id: `cs_test_${suffix}`, object: "checkout.session" } },
      });
      assert.equal(res.status, 200);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      assert.equal(workspace.credits, 110);
    });

    await runTest("invoice.payment_succeeded renewal adds plan credits once", async () => {
      const res = await signedWebhookRequest(stripe, {
        id: invoiceEventId,
        object: "event",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: `in_test_${suffix}`,
            object: "invoice",
            customer: customerId,
            billing_reason: "subscription_cycle",
          },
        },
      });
      assert.equal(res.status, 200);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      assert.equal(workspace.credits, 210);
    });

    await runTest("subscription.deleted downgrades to FREE and caps credits", async () => {
      const res = await signedWebhookRequest(stripe, {
        id: deleteEventId,
        object: "event",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: subscriptionId,
            object: "subscription",
          },
        },
      });
      assert.equal(res.status, 200);
      const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      const subscription = await prisma.subscription.findUniqueOrThrow({ where: { workspaceId } });
      assert.equal(workspace.plan, "FREE");
      assert.equal(workspace.credits, 10);
      assert.equal(subscription.status, "CANCELED");
    });
  } finally {
    if (server) {
      server.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (server.exitCode === null) server.kill("SIGKILL");
    }
    if (CLEANUP) {
      if (workspaceId) {
        await prisma.user.deleteMany({ where: { email } });
      }
      await prisma.stripeEvent.deleteMany({ where: { id: { in: [checkoutEventId, invoiceEventId, deleteEventId] } } });
    } else {
      console.log(`cleanup skipped - metadata written to ${CLEANUP_FILE}`);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
