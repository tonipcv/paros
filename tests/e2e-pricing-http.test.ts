import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";

const PORT = 3022;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function testEnv() {
  return {
    ...process.env,
    NEXT_PUBLIC_APP_URL: BASE_URL,
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    OPENROUTER_API_KEY: "",
    OPENAI_API_KEY: "",
    TEE_ATTESTATION_DISABLED: "true",
  };
}

function startServer() {
  const child = spawn("./node_modules/.bin/next", ["dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: process.cwd(),
    env: testEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[next] ${chunk}`));
  return child;
}

async function waitForServer(child: ChildProcess) {
  const deadline = Date.now() + 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next dev server exited with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(BASE_URL, { redirect: "manual" });
      if (res.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next dev server did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function get(path: string, init?: RequestInit) {
  return fetch(`${BASE_URL}${path}`, { redirect: "manual", ...init });
}

async function post(path: string, body: unknown, headers?: HeadersInit) {
  return get(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
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
  const server = startServer();
  try {
    await waitForServer(server);

    await runTest("landing renders without stale pricing copy", async () => {
      const res = await get("/");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.length > 1_000, "landing response should contain rendered HTML");
      assert.ok(!html.includes("7,500 credits / month"));
      assert.ok(!html.includes("22,500 credits / month"));
      assert.ok(!html.includes("Start with 500 free credits."));
    });

    await runTest("signup page does not advertise stale free credits", async () => {
      const res = await get("/signup");
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.length > 1_000, "signup response should contain rendered HTML");
      assert.ok(!html.includes("Start with 500 free credits."));
    });

    await runTest("billing page is protected by middleware", async () => {
      const res = await get("/billing");
      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location, "redirect location required");
      assert.equal(new URL(location, BASE_URL).pathname, "/login");
    });

    await runTest("checkout rejects missing Origin before auth or Stripe work", async () => {
      const res = await post("/api/stripe/checkout", { plan: "STARTER", billingCycle: "yearly" });
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: "Invalid origin" });
    });

    await runTest("portal rejects missing Origin before auth or Stripe work", async () => {
      const res = await post("/api/stripe/portal", {});
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: "Invalid origin" });
    });

    await runTest("cron reset endpoint requires CRON_SECRET bearer token", async () => {
      const res = await get("/api/cron/reset-free-credits");
      assert.equal(res.status, 401);
      assert.equal(await res.text(), "Unauthorized");
    });
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (server.exitCode === null) server.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
