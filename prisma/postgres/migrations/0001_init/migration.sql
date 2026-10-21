-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "prizePoolSol" DOUBLE PRECISION NOT NULL,
    "payoutSplit" TEXT NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "dataUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WagerEntry" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "wageredSol" DOUBLE PRECISION NOT NULL,
    "wageredUsd" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WagerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcludedUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcludedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "amountSol" DOUBLE PRECISION NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "txNote" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Period_startsAt_idx" ON "Period"("startsAt");

-- CreateIndex
CREATE INDEX "Period_endsAt_idx" ON "Period"("endsAt");

-- CreateIndex
CREATE INDEX "WagerEntry_periodId_wageredSol_idx" ON "WagerEntry"("periodId", "wageredSol");

-- CreateIndex
CREATE UNIQUE INDEX "WagerEntry_periodId_username_key" ON "WagerEntry"("periodId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "ExcludedUser_username_key" ON "ExcludedUser"("username");

-- CreateIndex
CREATE INDEX "Payout_periodId_rank_idx" ON "Payout"("periodId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_periodId_username_key" ON "Payout"("periodId", "username");

-- CreateIndex
CREATE INDEX "Snapshot_periodId_takenAt_idx" ON "Snapshot"("periodId", "takenAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- AddForeignKey
ALTER TABLE "WagerEntry" ADD CONSTRAINT "WagerEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

