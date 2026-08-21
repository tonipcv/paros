import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const engine = readFileSync("src/lib/billing-engine.ts", "utf8");
const dashboard = readFileSync("src/app/api/admin/unit-economics/route.ts", "utf8");
const imageRoute = readFileSync("src/app/api/images/route.ts", "utf8");
const apiChat = readFileSync("src/app/api/v1/chat/completions/route.ts", "utf8");
const grants = readFileSync("src/lib/credit-grants.ts", "utf8");
const stripeWebhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const account = readFileSync("src/lib/account.ts", "utf8");

assert.match(engine, /modeOverride \|\| billingMode\(\)/);
assert.match(engine, /RECONCILIATION_REQUIRED/);
assert.match(engine, /providerAccess/);
assert.match(apiChat, /meterOpenAIResponse/);
assert.match(apiChat, /modeOverride: "shadow"/);
assert.match(imageRoute, /requireBillingReconciliation/);
assert.doesNotMatch(imageRoute, /settleDailySpend\(ws\.id, estMicros, 0n\)/);
assert.match(dashboard, /unreconciledOlderThan15Minutes/);
assert.match(dashboard, /settledWithoutCost/);
assert.match(grants, /monthlyAllowance \* 2/);
assert.match(grants, /COGS_MICROS_PER_CREDIT/);
assert.match(stripeWebhook, /stripe:invoice:/);
assert.match(stripeWebhook, /stripe:checkout:/);
assert.match(account, /providerAccess: true/);
assert.match(account, /orderBy: \[\{ expiresAt: "asc" \}, \{ grantedAt: "asc" \}\]/);
assert.match(account, /creditDebit\.create/);
assert.match(grants, /expireCreditGrants/);
assert.match(grants, /resetFreeMonthlyGrant/);

console.log("ok - unit economics controls are wired in shadow mode");
