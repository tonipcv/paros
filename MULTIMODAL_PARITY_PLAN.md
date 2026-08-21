# Multimodal infrastructure parity plan

## Objective

Reach Venice-level modality infrastructure without copying provider-exclusive models. Public model IDs remain stable while OpenRouter, fal, OpenAI, Replicate and future OpenAI-compatible providers supply interchangeable routes.

## Research conclusions

- OpenRouter exposes OpenAI-compatible chat and embeddings, including multimodal embeddings, and separate discovery endpoints for embedding and image models.
- fal recommends asynchronous inference through its durable queue. Requests support status polling, cancellation, SSE status and signed completion webhooks. Provider media can expire and must be copied to owned storage.
- Replicate predictions may be synchronous or asynchronous, support polling and retrying webhooks, and remove API inputs/outputs after one hour by default. Completed artifacts must be persisted immediately.
- OpenAI transcription is multipart and supports FLAC, MP3/MP4, MPEG/MPGA, M4A, OGG, WAV and WebM. Transcription variants support JSON, streaming, timestamps and diarization with model-specific constraints.
- Long-running media operations cannot share the synchronous chat accounting path. They require durable jobs, idempotency, cancellation and reconciliation.

Primary references:

- https://openrouter.ai/docs/api/reference/embeddings
- https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- https://fal.ai/docs/documentation/model-apis/inference/queue
- https://fal.ai/docs/documentation/model-apis/inference/webhooks
- https://replicate.com/docs/reference/http/
- https://replicate.com/docs/topics/webhooks/
- https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create

## Coverage matrix

| Capability | Target contract | Initial provider | Execution model | Status |
|---|---|---|---|---|
| Chat/reasoning/tools | `/api/v1/chat/completions` | OpenRouter + compatible routes | Sync/stream | Operational |
| Embeddings | `/api/v1/embeddings` | OpenRouter | Sync | Implemented |
| Text to speech | `/api/v1/audio/speech` | OpenAI | Sync | Operational |
| Speech to text | `/api/v1/audio/transcriptions` | OpenAI | Sync/stream later | Implemented |
| Image generation | `/api/v1/images/generations` | OpenRouter + fal | Sync | Operational |
| Image edit/inpaint | `/api/v1/generations` | fal | Async | Core implemented; model manifests pending |
| Upscale | `/api/v1/generations` | fal | Async | Core implemented; model manifests pending |
| Text/image to video | `/api/v1/generations` | fal, then Replicate | Async | Core implemented; model manifests pending |
| Music | `/api/v1/generations` | fal, then Replicate | Async | Core implemented; model manifests pending |
| Persistent artifacts | Job artifacts + R2 | Internal | Background copy | Schema implemented; worker pending |

## Shared architecture

1. `CatalogModel` owns the stable product identity.
2. `ModelRoute` maps that identity to one or more provider IDs.
3. `ModelPrice` normalizes billable units.
4. Synchronous calls reserve credits, call a route, settle usage and fail over when safe.
5. Long-running calls create `GenerationJob`, reserve credits once, submit with an idempotency key, and return HTTP 202.
6. Signed provider webhooks settle jobs exactly once through `ProviderWebhookEvent`.
7. Outputs become `GeneratedArtifact` records and must be copied to R2 before provider expiration.
8. Cancellation either confirms provider cancellation and refunds or enters `RECONCILIATION_REQUIRED`.

## Security requirements

- API keys and provider credentials remain server-side.
- Webhooks are verified over the raw body, protected against replay with a five-minute timestamp window and persisted idempotently.
- User input is allowlisted per operation; provider-specific arbitrary parameters are never forwarded directly.
- Remote input URLs require SSRF protection, content-length limits and MIME sniffing before providers receive them.
- Jobs and artifacts are scoped by workspace on every read/cancel operation.
- Provider logs, prompts and payloads must not be written to application logs.

## Accounting requirements

- Text/embeddings: input/output or input tokens.
- Image/inpaint/upscale: image count, megapixels and quality tier.
- Video: generated seconds, resolution and optional audio.
- Audio/music: seconds or characters according to provider billing.
- Reserve the maximum bounded amount before submission.
- Settle using provider-reported cost where available.
- Failures before provider acceptance refund immediately.
- Unknown provider outcomes enter reconciliation; never guess a refund.

## Delivery phases

### Phase A — platform core

- Durable generation jobs and artifacts.
- Signed fal webhook ingestion.
- Idempotent submission and cancellation.
- Embeddings and API-key transcription.
- Dedicated OpenRouter embedding discovery.

### Phase B — image operations

- Curated fal manifests for inpaint, image editing and upscale.
- Operation-specific Zod schemas.
- Source image ingestion and R2 persistence.
- Resolution-aware reservation and settlement.

### Phase C — video and music

- Text-to-video, image-to-video and video editing.
- Music generation with duration constraints.
- Polling/reconciliation cron for missed webhooks.
- Artifact persistence worker and expiration alerts.

### Phase D — provider redundancy

- Replicate adapter and verified webhook handler.
- Alternative routes for the highest-volume models.
- Per-route circuit breakers, concurrency limits and cost-aware routing.

### Phase E — product and operations

- Model explorer for all modalities.
- Job history, progress, cancel and retry UI.
- Admin queue/provider dashboards.
- Per-modality metrics, budgets, alerts and provider reconciliation.

## Definition of done

- Every advertised model has a passing contract test for its declared capabilities.
- Every asynchronous operation survives process restarts and duplicate webhooks.
- No successful provider output depends on an expiring provider URL.
- Cancellation and webhook races cannot double-refund or double-charge.
- Pricing tests cover every billable unit and enforce plan limits.
- Load tests cover at least 600 catalog models, 1,000 queued jobs and 100 concurrent status reads.
- Production dashboards expose queue age, failure rate, provider latency, reconciliation count and unpersisted artifact count.
