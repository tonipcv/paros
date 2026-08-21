import assert from "node:assert/strict";
import {
  COGS_MICROS_PER_CREDIT,
  creditsForCost,
  creditsToReserve,
  estimateTextCostMicros,
  parseTokenCount,
  settleCredits,
} from "../src/lib/unit-economics";
import { allocateGrantCredits } from "../src/lib/credit-grants";

function test(name: string, fn: () => void) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

test("one credit represents 1.5 cents of adjusted COGS", () => {
  assert.equal(COGS_MICROS_PER_CREDIT, 15_000n);
  assert.equal(creditsForCost(1n), 1);
  assert.equal(creditsForCost(15_000n), 1);
  assert.equal(creditsForCost(15_001n), 2);
});

test("reservation adds a 15 percent buffer", () => {
  assert.equal(creditsToReserve(15_000n), 2);
  assert.equal(creditsToReserve(100_000n), 8);
});

test("settlement refunds excess and reports a reservation deficit", () => {
  assert.deepEqual(settleCredits(8, 45_000n), { creditsSettled: 3, creditsRefunded: 5, creditsAdditional: 0 });
  assert.deepEqual(settleCredits(2, 45_000n), { creditsSettled: 3, creditsRefunded: 0, creditsAdditional: 1 });
});

test("text COGS includes cached tokens and provider fee", () => {
  const micros = estimateTextCostMicros(
    { inputUsdPerMillion: 10, outputUsdPerMillion: 50, cachedInputUsdPerMillion: 1, providerFeeRate: 0.055 },
    { inputTokens: 2_000, cachedInputTokens: 1_000, outputTokens: 1_000 },
  );
  assert.equal(micros, 64_355n);
  assert.equal(creditsForCost(micros), 5);
});

test("context labels parse K, M and B correctly", () => {
  assert.equal(parseTokenCount("128K"), 128_000);
  assert.equal(parseTokenCount("1M"), 1_000_000);
  assert.equal(parseTokenCount("2M"), 2_000_000);
  assert.equal(parseTokenCount("1.5M"), 1_500_000);
  assert.equal(parseTokenCount("bad"), undefined);
});

test("grant allocation is FIFO and falls back to legacy balance", () => {
  const allocated = allocateGrantCredits([
    { id: "expires-first", creditsRemaining: 2, cogsRemainingMicros: 30_000n },
    { id: "expires-second", creditsRemaining: 5, cogsRemainingMicros: 75_000n },
  ], 9);
  assert.deepEqual(allocated, {
    allocations: [{ grantId: "expires-first", credits: 2 }, { grantId: "expires-second", credits: 5 }],
    legacyCredits: 2,
  });
});

test("grant allocation cannot exceed its remaining COGS budget", () => {
  assert.deepEqual(allocateGrantCredits([
    { id: "budget-limited", creditsRemaining: 10, cogsRemainingMicros: 16_000n },
  ], 5), { allocations: [{ grantId: "budget-limited", credits: 1 }], legacyCredits: 4 });
});
