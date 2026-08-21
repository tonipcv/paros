import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { creditsForCost, creditsToReserve, estimateTextCostMicros } from "../src/lib/unit-economics";

function read(path: string) {
  return readFileSync(path, "utf8");
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

test("chat charge is never below the advertised flat price and covers estimated COGS", () => {
  const chat = read("src/app/api/chat/route.ts");
  assert.ok(chat.includes("Math.max(model.credits, shadowPricing ? creditsToReserve(shadowPricing.estimatedCostMicros) : 0)"), "chargeCredits must be max(flat, estimated COGS)");
  assert.ok(chat.includes("reserveCredits(ws.id, chargeCredits)"), "reservation must use chargeCredits");
});

test("chat settle charges the difference when actual usage exceeds the reservation", () => {
  const chat = read("src/app/api/chat/route.ts");
  assert.ok(chat.includes("chargeCreditsAdditional(ws.id, additional)"), "must attempt an additional charge on overspend");
  assert.ok(chat.includes("markAttemptReconciliationRequired(finalAttemptId, generationId, \"insufficient credits for actual usage\")"), "must flag reconciliation when the additional charge fails");
  assert.ok(chat.includes("Math.max(model.credits, actualCredits)"), "settled credits must keep the flat price as floor");
});

test("chat settle refunds only what exceeds the flat price floor", () => {
  const chat = read("src/app/api/chat/route.ts");
  assert.ok(chat.includes("const refundAmount = creditsHeld - settledCredits;"), "refund is the difference between held and settled");
});

test("STT charges per audio duration with byte and time caps", () => {
  const stt = read("src/app/api/stt/route.ts");
  assert.ok(stt.includes("MAX_AUDIO_BYTES = 25 * 1024 * 1024"), "app STT must cap file size");
  assert.ok(stt.includes("MAX_AUDIO_SECONDS = 15 * 60"), "app STT must cap duration");
  assert.ok(stt.includes("creditsForCost(estimatedMicros)"), "app STT must price by estimated cost");
  assert.ok(stt.includes("reserveDailySpend(ws.id, estimatedMicros, limitMicros)"), "app STT must reserve daily spend");
  assert.ok(stt.includes("audioDurationSeconds(file)"), "app STT must parse audio duration");
});

test("v1 transcriptions charge per duration with time cap", () => {
  const v1 = read("src/app/api/v1/audio/transcriptions/route.ts");
  assert.ok(v1.includes("MAX_AUDIO_SECONDS = 15 * 60"), "v1 STT must cap duration");
  assert.ok(v1.includes("estimateAudioCostMicros(model.id, seconds)"), "v1 STT must price by catalog minute price");
  assert.ok(v1.includes("Math.max(model.credits, creditsToReserve(estimatedMicros))"), "v1 STT must keep flat price as floor");
  assert.ok(v1.includes("Could not determine audio duration"), "v1 STT must fail closed when duration is unknown");
});

test("audio pricing falls back to the whisper-1 rate when the catalog has no minute price", () => {
  const pricing = read("src/lib/billing-pricing.ts");
  assert.ok(pricing.includes("ASR_DEFAULT_USD_PER_MINUTE = 0.006"), "default must be whisper-1 $0.006/min");
  assert.ok(pricing.includes("unit: \"MINUTE\""), "must look up MINUTE-unit catalog prices");
});

test("audio duration parsing fails closed with a byte-based conservative estimate", () => {
  const audio = read("src/lib/openai-audio.ts");
  assert.ok(audio.includes("parseBuffer"), "must parse real metadata duration");
  assert.ok(audio.includes("FALLBACK_BYTES_PER_SECOND"), "must have a worst-case byte fallback");
});

test("15 minutes of whisper audio costs 6 credits (never the old flat 1)", () => {
  const micros = BigInt(15 * 60) * 100n;
  assert.equal(creditsForCost(micros), 6);
});

test("30 seconds of whisper audio still costs at least the flat 1 credit", () => {
  const micros = BigInt(30) * 100n;
  assert.equal(creditsForCost(micros), 1);
});

test("chat reservation for an expensive long request exceeds the flat price", () => {
  // claude-opus-4.8-class pricing: $5/M input, $25/M output, 60k input + 16k output
  const micros = estimateTextCostMicros(
    { inputUsdPerMillion: 5, outputUsdPerMillion: 25, providerFeeRate: 0.055 },
    { inputTokens: 60_000, outputTokens: 16_000 }
  );
  assert.ok(creditsToReserve(micros) > 10, `expected >10 credits for a long opus-class request, got ${creditsToReserve(micros)}`);
});
