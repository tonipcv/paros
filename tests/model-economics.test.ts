import assert from "node:assert/strict";
import { dynamicCreditsForCost, planUnitEconomics, scenarioCostUsd } from "../src/lib/model-economics";
import { falVideoCostUsd, topazImageCostUsd, tts1CostMicros } from "../src/lib/provider-pricing";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

test("text scenario combines input and output prices", () => {
  const cost = scenarioCostUsd([
    { unit: "MILLION_INPUT_TOKENS", usd: 5 },
    { unit: "MILLION_OUTPUT_TOKENS", usd: 15 },
  ], "openai");
  assert.equal(cost?.providerCost, 0.025);
  assert.equal(dynamicCreditsForCost(cost!.adjustedCogs), 2);
});

test("OpenRouter credit purchase fee is allocated to adjusted COGS", () => {
  const cost = scenarioCostUsd([{ unit: "REQUEST", usd: 1 }], "openrouter");
  assert.equal(cost?.adjustedCogs, 1.055);
});

test("direct modality tiers calculate supplier cost", () => {
  assert.ok(Math.abs(falVideoCostUsd("fal-ai/vidu/q3/text-to-video", 5, "720p")! - 0.77) < 1e-9);
  assert.equal(falVideoCostUsd("fal-ai/wan/v2.7/text-to-video", 5, "1080p"), 0.75);
  assert.equal(topazImageCostUsd(48), 0.16);
  assert.equal(tts1CostMicros(1000), 15_000n);
});

test("standard scenario uses the provider default video resolution", () => {
  assert.ok(Math.abs(scenarioCostUsd([{ unit: "SECOND", usd: 0.07 }], "fal", "fal-ai/vidu/q3/text-to-video")!.providerCost - 0.77) < 1e-9);
  assert.equal(scenarioCostUsd([{ unit: "SECOND", usd: 0.10 }], "fal", "fal-ai/wan/v2.7/text-to-video")!.providerCost, 0.75);
});

test("plan margin is computed from net revenue per credit", () => {
  const max = planUnitEconomics(10, 0.10).find((plan) => plan.plan === "MAX");
  assert.ok(max && max.marginUsd > 0);
});
