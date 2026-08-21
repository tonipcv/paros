// True end-to-end test of the security + billing hardening:
//   signup -> session cookie -> session token is HASHED at rest
//   unverified user is blocked (403) on every credit-consuming route
//   verify email -> chat works, credits charged exactly (demo mode)
//   STT duration/byte caps reject oversized audio; upstream failure refunds
//   guests bypass email verification (throwaway accounts are the intended escape)
//   cron endpoints reject requests without the CRON_SECRET
// Boots the real Next.js server against the dev DB; test users are deleted after.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import type { AddressInfo } from "node:net";

type Captured = { headers: IncomingHttpHeaders; body: Record<string, unknown> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PORT = 3213;
const BASE = `http://127.0.0.1:${PORT}`;
const TURNSTILE_TOKEN = "test-turnstile-token";

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

function wavBytes(seconds: number, sampleRate = 8000) {
  const dataSize = seconds * sampleRate * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(dataSize, 40);
  return buf;
}

async function main() {
  const captured: Captured[] = [];
  const mock = createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
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
        DEFAULT_CHAT_MODEL: "meta-llama/llama-3.3-70b-instruct",
        // Chat runs in offline demo mode (no upstream charge); STT passes the
        // config check but the upstream call fails -> exercises the refund path.
        OPENROUTER_API_KEY: "",
        OPENAI_API_KEY: "dummy-key",
        TURNSTILE_SECRET_KEY: "test-turnstile-secret",
        TURNSTILE_SITEVERIFY_URL: `http://127.0.0.1:${mockPort}/siteverify`,
        TELEGRAM_BOT_TOKEN: "",
        CRON_SECRET: "test-cron-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout?.on("data", (d) => process.env.E2E_VERBOSE ? process.stdout.write(`[next] ${d}`) : undefined);
    server.stderr?.on("data", (d) => process.env.E2E_VERBOSE ? process.stderr.write(`[next] ${d}`) : undefined);

    await waitForServer(`${BASE}/`);

    const email = `e2e-sec-${Date.now()}@test.local`;
    const password = "E2ePassword123!";
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
      return captured.length >= count;
    }

    const { prisma } = await import("../src/lib/prisma");
    const creditsAfterBlocked = async () => (await prisma.workspace.findUnique({ where: { userId: user!.id } }))!.credits;

    // ── 1. Signup + session hashing ──
    const signupRes = await fetch(`${BASE}/api/signup`, withIp({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "E2E Sec", email, password, turnstileToken: TURNSTILE_TOKEN }),
    }));
    const signupBody = await signupRes.json();
    test("signup succeeds", () => {
      assert.equal(signupRes.status, 200, JSON.stringify(signupBody));
      assert.equal((signupBody as { ok?: boolean }).ok, true);
    });

    const cookie = signupRes.headers.get("set-cookie")?.split(";")[0] || "";
    test("signup sets a session cookie", () => {
      assert.ok(cookie.startsWith("krx_session=") || cookie.startsWith("__Host-krx_session="), `no cookie: ${cookie}`);
    });

    let user = await prisma.user.findUnique({ where: { email } });
    const rawToken = cookie.split("=").slice(1).join("=");
    const stored = await prisma.session.findFirst({ where: { userId: user!.id } });
    test("session token is hashed at rest (never the raw cookie value)", () => {
      assert.ok(stored, "no session row");
      assert.notEqual(stored!.token, rawToken);
      assert.equal(stored!.token, createHash("sha256").update(rawToken).digest("hex"));
    });

    // ── 2. Unverified user is blocked on every credit route ──
    const cookieHeader = { cookie };
    const chatBlocked = await fetch(`${BASE}/api/chat`, withIp({ method: "POST", headers: { ...cookieHeader, "content-type": "application/json" }, body: JSON.stringify({ ephemeral: true, content: "hi" }) }));
    test("unverified user gets 403 on chat", () => assert.equal(chatBlocked.status, 403));

    const keysBlocked = await fetch(`${BASE}/api/keys`, withIp({ method: "POST", headers: { ...cookieHeader, "content-type": "application/json" }, body: JSON.stringify({ name: "x" }) }));
    test("unverified user gets 403 on api keys", () => assert.equal(keysBlocked.status, 403));

    const ttsBlocked = await fetch(`${BASE}/api/tts`, withIp({ method: "POST", headers: { ...cookieHeader, "content-type": "application/json" }, body: JSON.stringify({ text: "hi", voice: "alloy" }) }));
    test("unverified user gets 403 on tts", () => assert.equal(ttsBlocked.status, 403));

    const shortWav = wavBytes(1);
    const sttForm = new FormData();
    sttForm.append("file", new Blob([shortWav], { type: "audio/wav" }), "audio.wav");
    const sttBlocked = await fetch(`${BASE}/api/stt`, withIp({ method: "POST", headers: cookieHeader, body: sttForm }));
    test("unverified user gets 403 on stt", () => assert.equal(sttBlocked.status, 403));

    const imgForm = new FormData();
    imgForm.append("prompt", "cat");
    const imagesBlocked = await fetch(`${BASE}/api/images`, withIp({ method: "POST", headers: cookieHeader, body: imgForm }));
    test("unverified user gets 403 on images", () => assert.equal(imagesBlocked.status, 403));

    const blockedCredits = await creditsAfterBlocked();
    test("blocked requests never spend credits", () => {
      assert.equal(blockedCredits, 10);
    });

    // ── 3. Verify email ──
    await waitForEmails(2);
    const verifyEmail = captured.find((c) => /verif/i.test(String(c.body.subject)));
    test("verification email was sent", () => assert.ok(verifyEmail));
    const match = /api\/email\/verify\?token=([a-f0-9]+)/.exec(String(verifyEmail!.body.html));
    test("verification email contains a usable token link", () => assert.ok(match));
    const verifyRes = await fetch(`${BASE}/api/email/verify?token=${match![1]}`, { redirect: "manual" });
    test("verify link succeeds", () => assert.ok(verifyRes.status >= 300 && verifyRes.status < 400, `status ${verifyRes.status}`));
    user = await prisma.user.findUnique({ where: { email } });
    test("user is marked emailVerified", () => assert.ok(user?.emailVerified));

    // ── 4. Verified user can chat; credits charged exactly ──
    const chatRes = await fetch(`${BASE}/api/chat`, withIp({ method: "POST", headers: { ...cookieHeader, "content-type": "application/json" }, body: JSON.stringify({ ephemeral: true, content: "hello" }) }));
    const chatText = await chatRes.text();
    test("verified user can chat (demo mode streams)", () => {
      assert.equal(chatRes.status, 200);
      assert.match(chatText, /OPENROUTER_API_KEY not configured/);
    });

    const creditsAfterChat = await creditsAfterBlocked();
    test("chat charged exactly the flat price of the default model (1 credit)", () => {
      assert.equal(creditsAfterChat, 9, `expected 9 credits after one chat, got ${creditsAfterChat}`);
    });

    // ── 5. STT: caps, duration pricing, and refund on upstream failure ──
    const sttShort = new FormData();
    sttShort.append("file", new Blob([shortWav], { type: "audio/wav" }), "audio.wav");
    const sttShortRes = await fetch(`${BASE}/api/stt`, withIp({ method: "POST", headers: cookieHeader, body: sttShort }));
    test("STT upstream failure returns an error", () => assert.equal(sttShortRes.status, 500));

    const creditsAfterStt = await creditsAfterBlocked();
    test("STT failure refunds the reserved credits", () => {
      assert.equal(creditsAfterStt, 9, `credits not refunded: ${creditsAfterStt}`);
    });

    const longWav = wavBytes(16 * 60);
    const sttLong = new FormData();
    sttLong.append("file", new Blob([longWav], { type: "audio/wav" }), "long.wav");
    const sttLongRes = await fetch(`${BASE}/api/stt`, withIp({ method: "POST", headers: cookieHeader, body: sttLong }));
    const sttLongBody = await sttLongRes.text();
    test("STT rejects audio over 15 minutes (413)", () => assert.equal(sttLongRes.status, 413, `got ${sttLongRes.status}: ${sttLongBody}`));

    const garbage = new FormData();
    garbage.append("file", new Blob([Buffer.from("not-audio-garbage")], { type: "audio/webm" }), "bad.webm");
    const sttBadRes = await fetch(`${BASE}/api/stt`, withIp({ method: "POST", headers: cookieHeader, body: garbage }));
    test("STT fails closed when duration cannot be parsed (422)", () => assert.equal(sttBadRes.status, 422));

    const creditsAfterCaps = await creditsAfterBlocked();
    test("rejected STT requests never spend credits", () => {
      assert.equal(creditsAfterCaps, 9);
    });

    // ── 6. Verified user can create an API key ──
    const keysRes = await fetch(`${BASE}/api/keys`, withIp({ method: "POST", headers: { ...cookieHeader, "content-type": "application/json" }, body: JSON.stringify({ name: "e2e" }) }));
    const keysBody = await keysRes.json();
    test("verified user can create an API key", () => {
      assert.equal(keysRes.status, 200);
      assert.ok((keysBody as { key?: string }).key?.startsWith("nb-"));
    });

    // ── 7. Guests bypass email verification ──
    const guestRes = await fetch(`${BASE}/api/guest`, withIp({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ turnstileToken: TURNSTILE_TOKEN }) }));
    const guestCookie = guestRes.headers.get("set-cookie")?.split(";")[0] || "";
    test("guest route creates a session", () => assert.ok(guestCookie));
    const guestChat = await fetch(`${BASE}/api/chat`, withIp({ method: "POST", headers: { cookie: guestCookie, "content-type": "application/json" }, body: JSON.stringify({ ephemeral: true, content: "hi" }) }));
    test("guest can chat without email verification", () => assert.equal(guestChat.status, 200));

    // ── 8. Cron endpoints require the CRON_SECRET ──
    const cronNoAuth = await fetch(`${BASE}/api/cron/cleanup-guests`);
    test("cron rejects requests without credentials", () => assert.equal(cronNoAuth.status, 401));
    const cronWrong = await fetch(`${BASE}/api/cron/cleanup-guests`, { headers: { authorization: "Bearer wrong-secret" } });
    test("cron rejects requests with a wrong secret", () => assert.equal(cronWrong.status, 401));
    const cronOk = await fetch(`${BASE}/api/cron/cleanup-guests`, { headers: { authorization: "Bearer test-cron-secret" } });
    test("cron accepts the configured secret", () => assert.equal(cronOk.status, 200));

    // ── Cleanup ──
    await prisma.user.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "guest_", endsWith: "@guest.local" }, name: "Guest" } }).catch(() => {});
    await prisma.rateLimit.deleteMany({ where: { key: { contains: testIp } } }).catch(() => {});
    console.log("all e2e security + billing tests pass");
  } finally {
    mock.close();
    if (server) server.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
