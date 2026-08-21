import assert from "node:assert/strict";
import { normalizeOpenRouterCatalog } from "../src/lib/catalog-sync";
import { CATALOG_PAGE_MAX } from "../src/lib/model-catalog";

const data = Array.from({ length: 650 }, (_, index) => ({
  id: `provider/model-${index}`,
  name: `Model ${index}`,
  description: "Scale test",
  context_length: 128_000,
  architecture: { input_modalities: index % 3 === 0 ? ["text", "image"] : ["text"], output_modalities: ["text"] },
  supported_parameters: ["tools", "response_format", "reasoning_effort"],
  pricing: { prompt: "0.000001", completion: "0.000004" },
  top_provider: { max_completion_tokens: 8192 },
}));

const normalized = normalizeOpenRouterCatalog({ data });
assert.equal(normalized.length, 650, "normalization must not truncate a 600+ model provider catalog");
assert.equal(normalized[0].contextTokens, 128_000);
assert.equal(normalized[0].capabilities.vision, true);
assert.equal(normalized[0].capabilities.functionCalling, true);
assert.equal(normalized[0].prices?.find((price) => price.unit === "MILLION_OUTPUT_TOKENS")?.usd, "4.00000000");
assert.equal(CATALOG_PAGE_MAX, 200, "API pages stay bounded independently of total catalog size");
console.log("ok - catalog normalizes 650 models without truncation and keeps bounded API pages");
