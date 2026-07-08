CREATE TABLE IF NOT EXISTS "health_checks" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'healthy',
  "message" TEXT,
  "durationMs" INTEGER,
  "alertSent" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "health_checks_name_createdAt_idx" ON "health_checks"("name", "createdAt");
