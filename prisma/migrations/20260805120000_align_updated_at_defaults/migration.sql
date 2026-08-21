-- AlterTable
ALTER TABLE "rate_limits" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stripe_events" ALTER COLUMN "updatedAt" DROP DEFAULT;

