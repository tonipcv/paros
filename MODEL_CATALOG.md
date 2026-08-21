# Model catalog architecture

The model catalog is designed for hundreds or thousands of models without keeping provider inventory in application source code.

## Data model

- `catalog_models`: stable public model identity, modality, lifecycle and product defaults.
- `model_capabilities`: queryable capability flags used by clients and routing.
- `model_providers`: aggregators, direct providers and self-hosted backends.
- `model_routes`: one or more provider routes for each public model, including health data.
- `model_prices`: effective-dated prices by token, request, image, character or time.
- `model_aliases`: compatibility IDs that resolve to a stable public model.
- `catalog_sync_runs`: audit trail for provider discovery and deprecation.

The bundled TypeScript catalog remains a fail-safe while the migration is being deployed. Once the database catalog contains active models, API reads and model resolution use it automatically.

## Deployment

```bash
npm run db:migrate
npm run db:seed
```

The seed imports the bundled chat and image models. Production synchronization runs every six hours through:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain/api/cron/sync-model-catalog?provider=openrouter"
```

Use `provider=bundled` to backfill the built-in catalog or `provider=all` for both sources.

## API

The OpenAI-compatible endpoint is cursor-paginated and accepts at most 200 records per request:

```text
GET /api/v1/models?type=text&limit=100
GET /api/v1/models?type=all&capability=functionCalling
GET /api/v1/models?type=image&provider=fal
GET /api/v1/models?search=deepseek
GET /api/v1/models?cursor=<public-model-id>
```

Supported types are `text`, `image`, `video`, `audio`, `embedding`, `music`, `upscale`, `inpaint`, `asr`, and `tts`.

The response includes capabilities, active routes, prices, aliases, `next_cursor`, and `has_more`. API responses expose a short private cache while provider synchronization writes independently.

## Operations

`GET /api/admin/model-catalog` returns counts by modality and lifecycle status, provider route totals, unhealthy route count, and recent synchronization runs.

Every API inference records route latency and an exponentially weighted error rate. Routes automatically become degraded after sustained failures, and route selection prioritizes healthy providers with lower configured priority, error rate and latency.

OpenAI-compatible direct providers use their catalog `baseUrl` and server-side credentials from a JSON environment variable:

```text
MODEL_PROVIDER_KEYS_JSON={"deepinfra":"...","fireworks":"...","together":"..."}
```

Provider slugs must match the keys in this object. OpenRouter and fal continue to use `OPENROUTER_API_KEY` and `FAL_KEY`. Credentials are never stored in catalog metadata or returned by an API.

## Adding a provider

1. Implement a defensive normalizer returning `CatalogImportModel` records.
2. Store provider-specific IDs only in `model_routes`.
3. Map prices into `PricingUnit` rather than provider-specific fields.
4. Upsert capabilities and route health independently of the stable public model.
5. Add a protected synchronization target and a contract test with at least 600 synthetic records.

Never publish arbitrary provider response fields directly or forward arbitrary inference parameters. Provider metadata belongs in the JSON metadata fields; fields used for filtering and routing must be normalized columns.
