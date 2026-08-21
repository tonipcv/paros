CREATE TYPE "BillingLedgerStatus" AS ENUM (
  'RESERVED',
  'SENT_TO_PROVIDER',
  'SETTLED',
  'RELEASED',
  'RECONCILIATION_REQUIRED',
  'FAILED'
);

CREATE TYPE "CreditGrantSource" AS ENUM ('FREE', 'SUBSCRIPTION', 'ADMIN', 'PROMOTION', 'API_PREPAID', 'MIGRATION');

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "providerAccess" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "billing_ledger" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "providerRequestId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "modality" "ModelModality" NOT NULL,
  "status" "BillingLedgerStatus" NOT NULL DEFAULT 'RESERVED',
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cachedTokens" INTEGER NOT NULL DEFAULT 0,
  "imageMegapixels" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "imageCount" INTEGER NOT NULL DEFAULT 0,
  "audioSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "videoSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "providerCostMicros" BIGINT NOT NULL DEFAULT 0,
  "providerFeeMicros" BIGINT NOT NULL DEFAULT 0,
  "toolsCostMicros" BIGINT NOT NULL DEFAULT 0,
  "privacyCostMicros" BIGINT NOT NULL DEFAULT 0,
  "reservedCostMicros" BIGINT NOT NULL DEFAULT 0,
  "settledCostMicros" BIGINT NOT NULL DEFAULT 0,
  "creditsReserved" INTEGER NOT NULL DEFAULT 0,
  "creditsSettled" INTEGER NOT NULL DEFAULT 0,
  "pricingVersion" TEXT NOT NULL,
  "creditPolicyVersion" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_ledger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_ledger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_ledger_requestId_key" ON "billing_ledger"("requestId");
CREATE INDEX IF NOT EXISTS "billing_ledger_workspaceId_createdAt_idx" ON "billing_ledger"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "billing_ledger_status_createdAt_idx" ON "billing_ledger"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "billing_ledger_provider_providerRequestId_idx" ON "billing_ledger"("provider", "providerRequestId");
CREATE INDEX IF NOT EXISTS "billing_ledger_model_createdAt_idx" ON "billing_ledger"("model", "createdAt");

ALTER TABLE "generation_jobs" ADD COLUMN IF NOT EXISTS "billingLedgerId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_billingLedgerId_key" ON "generation_jobs"("billingLedgerId");

CREATE TABLE IF NOT EXISTS "credit_grants" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "source" "CreditGrantSource" NOT NULL,
  "sourceRef" TEXT,
  "creditsGranted" INTEGER NOT NULL,
  "creditsRemaining" INTEGER NOT NULL,
  "cogsBudgetMicros" BIGINT NOT NULL,
  "cogsRemainingMicros" BIGINT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "expiredAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "credit_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_grants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_grants_sourceRef_key" ON "credit_grants"("sourceRef");
CREATE INDEX IF NOT EXISTS "credit_grants_workspaceId_expiresAt_idx" ON "credit_grants"("workspaceId", "expiresAt");
CREATE INDEX IF NOT EXISTS "credit_grants_workspaceId_creditsRemaining_idx" ON "credit_grants"("workspaceId", "creditsRemaining");
