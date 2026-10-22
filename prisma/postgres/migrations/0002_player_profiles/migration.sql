-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "displayName" TEXT,
    "solpumpUsername" TEXT,
    "solpumpKey" TEXT,
    "solpumpStatus" TEXT NOT NULL DEFAULT 'none',
    "discordUsername" TEXT,
    "kickUsername" TEXT,
    "xUsername" TEXT,
    "hideName" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletNonce" (
    "nonce" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_wallet_key" ON "Player"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Player_solpumpKey_key" ON "Player"("solpumpKey");

-- CreateIndex
CREATE INDEX "Player_solpumpStatus_idx" ON "Player"("solpumpStatus");

-- CreateIndex
CREATE INDEX "WalletNonce_wallet_idx" ON "WalletNonce"("wallet");

-- CreateIndex
CREATE INDEX "WalletNonce_expiresAt_idx" ON "WalletNonce"("expiresAt");

