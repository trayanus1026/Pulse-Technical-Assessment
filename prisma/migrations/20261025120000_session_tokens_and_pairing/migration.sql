-- Presence/Signal rows are ephemeral coordination state, so clear them rather
-- than backfilling the new required token column.
DELETE FROM "Signal";
DELETE FROM "Presence";

-- AlterTable
ALTER TABLE "Presence" DROP COLUMN "busy",
ADD COLUMN     "tokenHash" TEXT NOT NULL,
ADD COLUMN     "peerId" TEXT,
ADD COLUMN     "pendingTo" TEXT,
ADD COLUMN     "lastRequestAt" TIMESTAMP(3),
ADD COLUMN     "rateStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "rateCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Presence_tokenHash_key" ON "Presence"("tokenHash");

-- CreateIndex
CREATE INDEX "Presence_peerId_idx" ON "Presence"("peerId");

-- CreateIndex
CREATE INDEX "Presence_pendingTo_idx" ON "Presence"("pendingTo");

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");
