CREATE TABLE "credit_debits" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "allocations" JSONB NOT NULL DEFAULT '[]',
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_debits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_debits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "credit_debits_workspaceId_refundedAt_createdAt_idx" ON "credit_debits"("workspaceId", "refundedAt", "createdAt");
