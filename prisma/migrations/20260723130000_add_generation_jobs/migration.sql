CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "ArtifactKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'MUSIC', 'FILE');

CREATE TABLE "generation_jobs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "publicModelId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerModelId" TEXT NOT NULL,
  "providerRequestId" TEXT,
  "modality" "ModelModality" NOT NULL,
  "operation" TEXT NOT NULL,
  "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "input" JSONB NOT NULL,
  "output" JSONB NOT NULL DEFAULT '{}',
  "error" TEXT,
  "idempotencyKey" TEXT,
  "creditsReserved" INTEGER NOT NULL DEFAULT 0,
  "actualCostMicros" BIGINT NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "generated_artifacts" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "kind" "ArtifactKind" NOT NULL,
  "url" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generated_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_webhook_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "provider_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generation_jobs_provider_providerRequestId_key" ON "generation_jobs"("provider", "providerRequestId");
CREATE UNIQUE INDEX "generation_jobs_workspaceId_idempotencyKey_key" ON "generation_jobs"("workspaceId", "idempotencyKey");
CREATE INDEX "generation_jobs_workspaceId_status_createdAt_idx" ON "generation_jobs"("workspaceId", "status", "createdAt");
CREATE INDEX "generation_jobs_status_updatedAt_idx" ON "generation_jobs"("status", "updatedAt");
CREATE INDEX "generation_jobs_provider_status_idx" ON "generation_jobs"("provider", "status");
CREATE INDEX "generated_artifacts_jobId_idx" ON "generated_artifacts"("jobId");
CREATE INDEX "generated_artifacts_workspaceId_createdAt_idx" ON "generated_artifacts"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "provider_webhook_events_provider_eventId_key" ON "provider_webhook_events"("provider", "eventId");
CREATE INDEX "provider_webhook_events_processed_receivedAt_idx" ON "provider_webhook_events"("processed", "receivedAt");

ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "generation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
