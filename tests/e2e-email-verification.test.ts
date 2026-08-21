// True end-to-end test of the email verification flow: boots the real Next.js
// server, points the Cloudflare Email Service transport at a local mock, and
// drives the real HTTP flow against the dev DB:
//   signup -> welcome + verification email (Cloudflare payload shape)
//   verify link -> emailVerified set, token single-use
//   resend -> new token + email, rate limited
//   password reset email
// The test user is deleted afterwards.

import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import type { AddressInfo } from "node:net";

type Captured = { headers: IncomingHttpHeaders; body: Record<string, unknown> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PORT = 3212;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(url: string, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.status < 500) return;
    } catch {
      /* retry */
    }
    await sleep(300);
  }
  throw new Error(`server did not come up at ${url}`);
}

async function main() {
  const captured: Captured[] = [];
  const mock = createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      // Turnstile siteverify mock: succeed without polluting the email capture.
      if (req.url?.includes("/siteverify")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }
      captured.push({ headers: req.headers, body: JSON.parse(data || "{}") });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    });
  });
  await new Promise<void>((r) => mock.listen(0, r));
  const mockPort = (mock.address() as AddressInfo).port;

  const envFile = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const getEnv = (k: string) => (envFile.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^"|"$/g, "") || "";

  let server: ChildProcess | null = null;
  try {
    server = spawn("npx", ["next", "start", "-p", String(PORT)], {
      env: {
        ...process.env,
        DATABASE_URL: getEnv("DATABASE_URL"),
        EMAIL_PROVIDER: "cloudflare",
        CF_EMAIL_ENDPOINT: `http://127.0.0.1:${mockPort}/send`,
        CF_EMAIL_API_TOKEN: "test-cf-token",
        CLOUDFLARE_ACCOUNT_ID: "test-account",
        EMAIL_FROM: "KRX Test <test@heuv.dev>",
        EMAIL_REPLY_TO: "test@heuv.dev",
        NEXT_PUBLIC_APP_URL: BASE,
        NEXT_PUBLIC_APP_NAME: "KRX",
        TURNSTILE_SECRET_KEY: "test-turnstile-secret",
        TURNSTILE_SITEVERIFY_URL: `http://127.0.0.1:${mockPort}/siteverify`,
        TELEGRAM_BOT_TOKEN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (d) => process.env.E2E_VERBOSE ? process.stdout.write(`[next] ${d}`) : undefined);
    server.stderr?.on("data", (d) => process.env.E2E_VERBOSE ? process.stderr.write(`[next] ${d}`) : undefined);

    await waitForServer(`${BASE}/`);

    const email = `e2e-verify-${Date.now()}@test.local`;
    const password = "E2ePassword123!";
    // Unique per-run IP so the shared rate-limit quotas are never pre-consumed
    // by earlier runs (or other tests) against the same dev DB.
    const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
    const withIp = (init: RequestInit = {}) => ({
      ...init,
      headers: { ...(init.headers as Record<string, string>), "x-forwarded-for": testIp },
    });

    function test(name: string, fn: () => void) {
      try {
        fn();
        console.log(`ok - ${name}`);
      } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
      }
    }

    async function waitForEmails(count: number, timeoutMs = 15_000) {
      const start = Date.now();
      while (captured.length < count && Date.now() - start < timeoutMs) await sleep(150);
      assert.ok(captured.length >= count, `expected ${count} emails, got ${captured.length}`);
    }

    async function waitForEmailsSafe(count: number, timeoutMs = 15_000) {
      const start = Date.now();
      while (captured.length < count && Date.now() - start < timeoutMs) await sleep(150);
      return captured.length >= count;
    }

    const signupRes = await fetch(`${BASE}/api/signup`, withIp({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "E2E Verify", email, password }),
    }));
    test("signup succeeds", async () => {
      const body = await signupRes.json();
      assert.equal(signupRes.status, 200, JSON.stringify(body));
      assert.equal(body.ok, true);
    });

    const sessionCookie = signupRes.headers.get("set-cookie")?.split(";")[0] || "";
    test("signup sets a session cookie", () => {
      assert.ok(sessionCookie.startsWith("krx_session=") || sessionCookie.startsWith("__Host-krx_session="), `no session cookie: ${sessionCookie}`);
    });

    await waitForEmails(2);
    test("signup sends welcome + verification via Cloudflare transport", () => {
      assert.equal(captured.length, 2);
    });

    test("Cloudflare payload has the right shape and auth", () => {
      for (const c of captured) {
        assert.equal(c.headers.authorization, "Bearer test-cf-token");
        assert.match(String(c.headers["content-type"]), /application\/json/);
        const b = c.body;
        assert.equal(b.from, "KRX Test <test@heuv.dev>");
        assert.equal(b.to, email);
        assert.ok(b.subject);
        assert.ok(String(b.html).length > 100);
      }
      const subjects = captured.map((c) => String(c.body.subject));
      assert.ok(subjects.some((s) => /welcome|confirmed|verify/i.test(s)), `subjects: ${subjects}`);
      assert.ok(subjects.some((s) => /verif/i.test(s)), `subjects: ${subjects}`);
    });

    const verifyEmail = captured.find((c) => /verif/i.test(String(c.body.subject)))!;
    const match = /api\/email\/verify\?token=([a-f0-9]+)/.exec(String(verifyEmail.body.html));
    test("verification email contains a usable token link", () => {
      assert.ok(match, "no token link in verification email");
    });
    const rawToken = match![1];

    const resend1 = await fetch(`${BASE}/api/email/resend`, withIp({ method: "POST", headers: { cookie: sessionCookie } }));
    test("resend issues a new verification email", async () => {
      assert.equal(resend1.status, 200);
      const before = captured.length;
      await waitForEmails(before + 1);
      assert.equal(captured.length, before + 1);
      assert.match(String(captured[captured.length - 1].body.subject), /verif/i);
    });

    let throttled = false;
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${BASE}/api/email/resend`, withIp({ method: "POST", headers: { cookie: sessionCookie } }));
      if (r.status === 429) throttled = true;
    }
    test("resend is rate limited (429)", () => {
      assert.ok(throttled, "no 429 seen after repeated resends");
    });

    const verifyRes = await fetch(`${BASE}/api/email/verify?token=${rawToken}`, { redirect: "manual" });
    test("verify link redirects to success", () => {
      assert.ok(verifyRes.status >= 300 && verifyRes.status < 400, `status ${verifyRes.status}`);
      assert.match(verifyRes.headers.get("location") || "", /status=success/);
    });

    const { prisma } = await import("../src/lib/prisma");
    const user = await prisma.user.findUnique({ where: { email } });
    test("user is marked emailVerified", () => {
      assert.ok(user?.emailVerified, "emailVerified not set");
    });

    const leftoverTokens = await prisma.emailVerificationToken.count({ where: { userId: user!.id, usedAt: null } });
    test("all verification tokens are consumed (single-use)", () => {
      assert.equal(leftoverTokens, 0, `${leftoverTokens} tokens still unused`);
    });

    const replay = await fetch(`${BASE}/api/email/verify?token=${rawToken}`, { redirect: "manual" });
    test("replaying the same token is rejected", () => {
      assert.match(replay.headers.get("location") || "", /status=invalid/);
    });

    const already = await fetch(`${BASE}/api/email/resend`, withIp({ method: "POST", headers: { cookie: sessionCookie } }));
    test("resend after verification reports alreadyVerified", async () => {
      assert.equal(already.status, 200);
      const body = (await already.json()) as { alreadyVerified?: boolean };
      assert.equal(body.alreadyVerified, true);
    });

    const beforeForgot = captured.length;
    const forgotRes = await fetch(`${BASE}/api/password/forgot`, withIp({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }));
    test("password reset email is sent through the same transport", async () => {
      assert.equal(forgotRes.status, 200);
      const wait = await waitForEmailsSafe(beforeForgot + 1);
      assert.ok(wait, `reset email missing (${captured.length} of ${beforeForgot + 1})`);
      assert.match(String(captured[captured.length - 1].body.subject), /reset/i);
    });

    await prisma.user.deleteMany({ where: { email } });
    await prisma.rateLimit.deleteMany({ where: { key: { contains: testIp } } }).catch(() => {});
  } finally {
    mock.close();
    if (server) server.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
