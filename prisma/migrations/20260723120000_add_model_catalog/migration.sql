CREATE TYPE "ModelModality" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'EMBEDDING', 'MUSIC', 'UPSCALE', 'INPAINT', 'ASR', 'TTS');
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEGRADED', 'OFFLINE', 'DEPRECATED');
CREATE TYPE "ProviderKind" AS ENUM ('AGGREGATOR', 'DIRECT', 'SELF_HOSTED');
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'DEGRADED', 'OFFLINE', 'DISABLED');
CREATE TYPE "PricingUnit" AS ENUM ('MILLION_INPUT_TOKENS', 'MILLION_OUTPUT_TOKENS', 'MILLION_CACHED_INPUT_TOKENS', 'IMAGE', 'SECOND', 'MINUTE', 'CHARACTER', 'REQUEST');
CREATE TYPE "CatalogSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

CREATE TABLE "model_providers" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "ProviderKind" NOT NULL DEFAULT 'AGGREGATOR',
  "baseUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "zeroRetention" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_models" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "author" TEXT NOT NULL DEFAULT '',
  "modality" "ModelModality" NOT NULL,
  "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
  "contextTokens" INTEGER,
  "maxOutputTokens" INTEGER,
  "credits" INTEGER NOT NULL DEFAULT 1,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 1000,
  "releasedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "replacementModelId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_capabilities" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "vision" BOOLEAN NOT NULL DEFAULT false,
  "videoInput" BOOLEAN NOT NULL DEFAULT false,
  "audioInput" BOOLEAN NOT NULL DEFAULT false,
  "reasoning" BOOLEAN NOT NULL DEFAULT false,
  "reasoningEffort" BOOLEAN NOT NULL DEFAULT false,
  "functionCalling" BOOLEAN NOT NULL DEFAULT false,
  "structuredOutput" BOOLEAN NOT NULL DEFAULT false,
  "logProbs" BOOLEAN NOT NULL DEFAULT false,
  "multipleImages" BOOLEAN NOT NULL DEFAULT false,
  "webSearch" BOOLEAN NOT NULL DEFAULT false,
  "uncensored" BOOLEAN NOT NULL DEFAULT false,
  "coding" BOOLEAN NOT NULL DEFAULT false,
  "streaming" BOOLEAN NOT NULL DEFAULT true,
  "tee" BOOLEAN NOT NULL DEFAULT false,
  "e2ee" BOOLEAN NOT NULL DEFAULT false,
  "imageGeneration" BOOLEAN NOT NULL DEFAULT false,
  "imageEditing" BOOLEAN NOT NULL DEFAULT false,
  "textToVideo" BOOLEAN NOT NULL DEFAULT false,
  "imageToVideo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_capabilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_aliases" (
  "id" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_routes" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerModelId" TEXT NOT NULL,
  "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "latencyMs" INTEGER,
  "errorRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lastCheckedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "model_prices" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "routeId" TEXT,
  "unit" "PricingUnit" NOT NULL,
  "usd" DECIMAL(20,8) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_sync_runs" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "status" "CatalogSyncStatus" NOT NULL DEFAULT 'RUNNING',
  "discovered" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "disabled" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "catalog_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "model_providers_slug_key" ON "model_providers"("slug");
CREATE INDEX "model_providers_enabled_priority_idx" ON "model_providers"("enabled", "priority");
CREATE UNIQUE INDEX "catalog_models_publicId_key" ON "catalog_models"("publicId");
CREATE INDEX "catalog_models_modality_status_sortOrder_idx" ON "catalog_models"("modality", "status", "sortOrder");
CREATE INDEX "catalog_models_author_idx" ON "catalog_models"("author");
CREATE INDEX "catalog_models_featured_status_idx" ON "catalog_models"("featured", "status");
CREATE UNIQUE INDEX "model_capabilities_modelId_key" ON "model_capabilities"("modelId");
CREATE UNIQUE INDEX "model_aliases_alias_key" ON "model_aliases"("alias");
CREATE INDEX "model_aliases_modelId_idx" ON "model_aliases"("modelId");
CREATE UNIQUE INDEX "model_routes_providerId_providerModelId_key" ON "model_routes"("providerId", "providerModelId");
CREATE INDEX "model_routes_modelId_status_priority_idx" ON "model_routes"("modelId", "status", "priority");
CREATE INDEX "model_routes_providerId_status_idx" ON "model_routes"("providerId", "status");
CREATE INDEX "model_prices_modelId_unit_effectiveAt_idx" ON "model_prices"("modelId", "unit", "effectiveAt");
CREATE INDEX "model_prices_routeId_idx" ON "model_prices"("routeId");
CREATE INDEX "catalog_sync_runs_providerId_startedAt_idx" ON "catalog_sync_runs"("providerId", "startedAt");

ALTER TABLE "model_capabilities" ADD CONSTRAINT "model_capabilities_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "catalog_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_aliases" ADD CONSTRAINT "model_aliases_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "catalog_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_routes" ADD CONSTRAINT "model_routes_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "catalog_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_routes" ADD CONSTRAINT "model_routes_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "model_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_prices" ADD CONSTRAINT "model_prices_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "catalog_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_prices" ADD CONSTRAINT "model_prices_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "model_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_sync_runs" ADD CONSTRAINT "catalog_sync_runs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "model_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
