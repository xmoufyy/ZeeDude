-- Record which client started each sign-in challenge, so one client can't
-- hold every open challenge and lock everyone else out of signing in.

-- AlterTable
ALTER TABLE "WalletNonce" ADD COLUMN "ip" TEXT NOT NULL DEFAULT 'direct';

-- CreateIndex
CREATE INDEX "WalletNonce_ip_expiresAt_idx" ON "WalletNonce"("ip", "expiresAt");
