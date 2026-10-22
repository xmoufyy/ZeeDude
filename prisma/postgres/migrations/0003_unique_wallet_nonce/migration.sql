-- Sign-in challenges are short-lived (5 min); clear them so older duplicate
-- wallets cannot block the new unique index.
DELETE FROM "WalletNonce";

-- DropIndex
DROP INDEX "WalletNonce_wallet_idx";

-- CreateIndex
CREATE UNIQUE INDEX "WalletNonce_wallet_key" ON "WalletNonce"("wallet");

