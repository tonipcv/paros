CREATE TABLE IF NOT EXISTS "admin_actions" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetUserId" TEXT,
  "targetEmail" TEXT,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_actions_adminId_createdAt_idx" ON "admin_actions"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "admin_actions_targetUserId_idx" ON "admin_actions"("targetUserId");
