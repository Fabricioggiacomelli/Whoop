-- DropIndex
DROP INDEX "whoop_sleeps_cycleId_key";

-- CreateIndex
CREATE INDEX "whoop_sleeps_cycleId_idx" ON "whoop_sleeps"("cycleId");
