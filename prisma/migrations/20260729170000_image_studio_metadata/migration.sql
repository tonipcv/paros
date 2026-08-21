ALTER TABLE "generated_images"
  ADD COLUMN IF NOT EXISTS "aspectRatio" TEXT NOT NULL DEFAULT '1:1',
  ADD COLUMN IF NOT EXISTS "quality" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "negativePrompt" TEXT,
  ADD COLUMN IF NOT EXISTS "seed" INTEGER,
  ADD COLUMN IF NOT EXISTS "favorite" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "generated_images_workspaceId_favorite_createdAt_idx"
  ON "generated_images"("workspaceId", "favorite", "createdAt");
