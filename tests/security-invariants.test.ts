import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Static guardrails: lock in the security hardening patterns so a future edit
// cannot silently regress them. These read the source and assert the invariant
// is present — cheap, deterministic, no network or DB.

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
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

const DATA_ROUTES = [
  "src/app/api/keys/route.ts",
  "src/app/api/keys/[id]/route.ts",
  "src/app/api/conversations/route.ts",
  "src/app/api/conversations/[id]/route.ts",
  "src/app/api/characters/route.ts",
  "src/app/api/characters/[id]/route.ts",
  "src/app/api/messages/route.ts",
  "src/app/api/usage/route.ts",
  "src/app/api/onboarding/route.ts",
  "src/app/api/images/route.ts",
  "src/app/api/account/encryption/route.ts",
];

test("public chat API clamps output tokens and bounds body size", () => {
  const src = read("src/app/api/v1/chat/completions/route.ts");
  assert.match(src, /MAX_OUTPUT_TOKENS\s*=\s*8192/);
  assert.match(src, /MAX_BODY_BYTES/);
  assert.match(src, /413/);
  // Must NOT blindly forward the whole client body to the upstream provider.
  assert.doesNotMatch(src, /\.\.\.body,\s*model:/);
});

test("auth-sensitive routes use the shared (cross-instance) rate limiter", () => {
  for (const p of [
    "src/app/api/login/route.ts",
    "src/app/api/signup/route.ts",
    "src/app/api/guest/route.ts",
    "src/app/api/stripe/checkout/route.ts",
    "src/app/api/stripe/portal/route.ts",
    "src/lib/api-auth.ts",
  ]) {
    assert.match(read(p), /rateLimitShared/, `${p} must use rateLimitShared`);
  }
});

test("login rate-limits per IP and per account", () => {
  const src = read("src/app/api/login/route.ts");
  assert.match(src, /login:ip:/);
  assert.match(src, /login:acct:/);
});

test("data routes never leak raw errors as 401", () => {
  for (const p of DATA_ROUTES) {
    const src = read(p);
    assert.doesNotMatch(src, /error\(e\.message,\s*401\)/, `${p} still leaks e.message as 401`);
    assert.match(src, /handleRouteError/, `${p} must use handleRouteError`);
  }
});

test("handleRouteError only surfaces 401 for auth failures", () => {
  const src = read("src/lib/http.ts");
  assert.match(src, /Authentication required/);
  assert.match(src, /Something went wrong/);
  assert.match(src, /500/);
});

test("stripe webhook dedupes renewal credits per invoice", () => {
  const src = read("src/app/api/stripe/webhook/route.ts");
  assert.match(src, /invoice_cycle:/);
});

test("metered routes reserve credits up front and refund on failure", () => {
  for (const p of [
    "src/app/api/images/route.ts",
    "src/app/api/chat/route.ts",
    "src/app/api/stt/route.ts",
    "src/app/api/tts/route.ts",
    "src/app/api/v1/images/generations/route.ts",
    "src/app/api/chat/e2ee/route.ts",
  ]) {
    const src = read(p);
    assert.match(src, /reserveCredits/, `${p} must reserve credits`);
    assert.match(src, /refundCredits/, `${p} must refund on failure`);
  }
});

test("cron endpoints authenticate with a timing-safe compare", () => {
  for (const p of ["src/app/api/cron/reset-free-credits/route.ts", "src/app/api/cron/cleanup-guests/route.ts"]) {
    assert.match(read(p), /timingSafeEqual/, `${p} must use timingSafeEqual`);
  }
});

test("E2EE proxy is fail-closed and never exposes the enclave key", () => {
  const src = read("src/app/api/chat/e2ee/route.ts");
  assert.match(src, /verifyTeeAttestation/);
  assert.match(src, /Refusing to send/);
  // The API key stays server-side; the route must not return baseUrl/apiKey.
  assert.doesNotMatch(src, /apiKey:\s*ep\.apiKey/);
});

test("E2EE sealing uses the ACI v2 secp256k1 suite and pipe AAD", () => {
  const src = read("src/lib/e2e-seal.ts");
  assert.match(src, /aci\.e2ee\.v2\.secp256k1/);
  assert.match(src, /v2\|req\|algo=/);
  assert.match(src, /v2\|resp\|algo=/);
});

test("E2EE mode refuses image attachments instead of dropping them", () => {
  const src = read("src/app/(app)/chat/page.tsx");
  assert.match(src, /privacyMode === "e2ee" && sendingImages\.length/);
});

test("Google OAuth rejects unverified emails and secures the state cookie", () => {
  assert.match(read("src/app/api/google/callback/route.ts"), /verified_email/);
  assert.match(read("src/app/api/auth/google/route.ts"), /secure:\s*process\.env\.NODE_ENV/);
});

test("no direct-to-enclave session route leaks the API key to the browser", () => {
  assert.throws(() => read("src/app/api/tee/session/route.ts"));
});

test("middleware does not duplicate the Permissions-Policy header", () => {
  assert.doesNotMatch(read("src/middleware.ts"), /Permissions-Policy/);
  assert.match(read("next.config.ts"), /Permissions-Policy/);
});

console.log("all security invariants hold");
