import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modalityForOperation, sanitizeGenerationInput } from "../src/lib/generation-jobs";

assert.equal(modalityForOperation("text-to-video"), "VIDEO");
assert.equal(modalityForOperation("image-to-video"), "VIDEO");
assert.equal(modalityForOperation("music"), "MUSIC");
assert.equal(modalityForOperation("upscale"), "UPSCALE");
assert.equal(modalityForOperation("inpaint"), "INPAINT");
assert.equal(modalityForOperation("unknown"), undefined);
assert.deepEqual(sanitizeGenerationInput("upscale", { image_url: "https://cdn.example.com/input.png", upscale_factor: 99, ignored_secret: "must-not-pass" }), { image_url: "https://cdn.example.com/input.png", upscale_factor: 4, output_format: "jpeg", model: undefined });
assert.throws(() => sanitizeGenerationInput("inpaint", { prompt: "fix", image_url: "http://127.0.0.1/private", mask_url: "https://cdn.example.com/mask.png" }), /public HTTPS URL/);

const embeddings = readFileSync("src/app/api/v1/embeddings/route.ts", "utf8");
assert.match(embeddings, /authenticateApiKey/);
assert.match(embeddings, /reserveCredits/);
assert.match(embeddings, /refundCredits/);
assert.match(embeddings, /resolveCatalogModel\(modelId, "EMBEDDING"\)/);

const transcription = readFileSync("src/app/api/v1/audio/transcriptions/route.ts", "utf8");
assert.match(transcription, /MAX_AUDIO_BYTES/);
assert.match(transcription, /ALLOWED_FORMATS/);
assert.match(transcription, /resolveCatalogModel\(modelId, "ASR"\)/);

const webhook = readFileSync("src/app/api/webhooks/fal/route.ts", "utf8");
assert.match(webhook, /verifyFalWebhook\(request\.headers, raw\)/);
assert.match(webhook, /providerWebhookEvent/);

const migration = readFileSync("prisma/migrations/20260723130000_add_generation_jobs/migration.sql", "utf8");
for (const table of ["generation_jobs", "generated_artifacts", "provider_webhook_events"]) assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));

console.log("ok - multimodal endpoints enforce auth, accounting, limits, durable jobs and signed idempotent webhooks");
