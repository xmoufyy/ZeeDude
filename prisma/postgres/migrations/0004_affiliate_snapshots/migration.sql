-- CreateTable
CREATE TABLE "AffiliateSnapshot" (
    "id" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateReading" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lifetimeSol" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AffiliateReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AffiliateSnapshot_takenAt_idx" ON "AffiliateSnapshot"("takenAt");

-- CreateIndex
CREATE INDEX "AffiliateReading_key_idx" ON "AffiliateReading"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateReading_snapshotId_key_key" ON "AffiliateReading"("snapshotId", "key");

-- AddForeignKey
ALTER TABLE "AffiliateReading" ADD CONSTRAINT "AffiliateReading_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AffiliateSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

