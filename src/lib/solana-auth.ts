import { createPublicKey, verify } from "node:crypto";

// Sign-in with a Solana wallet: the player signs a plain-text message with
// their wallet (no transaction, no fee) and we check the ed25519 signature
// against their public key, which is their wallet address.

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_MAP = new Map([...BASE58].map((c, i) => [c, i]));

/** Decodes base58 (Bitcoin/Solana alphabet). Returns null for invalid input. */
export function base58Decode(input: string): Uint8Array | null {
  if (!input || input.length > 128) return null;
  const bytes: number[] = [];
  for (const char of input) {
    let carry = BASE58_MAP.get(char);
    if (carry === undefined) return null;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Each leading "1" is a leading zero byte.
  for (const char of input) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

/** A Solana address is a base58-encoded 32-byte ed25519 public key. */
export function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) && base58Decode(value)?.length === 32;
}

export function buildSignInMessage({ domain, wallet, nonce, issuedAt }: { domain: string; wallet: string; nonce: string; issuedAt: Date }) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to ZeeDude Rewards to manage your profile. This only proves you own this wallet: it doesn't send a transaction or cost anything.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
  ].join("\n");
}

// DER prefix that turns a raw 32-byte ed25519 key into an SPKI public key.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** True when `signature` is the wallet's ed25519 signature over `message`. */
export function verifyWalletSignature(wallet: string, message: string, signature: Uint8Array): boolean {
  const publicKey = isSolanaAddress(wallet) ? base58Decode(wallet) : null;
  if (!publicKey || signature.length !== 64) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey]), format: "der", type: "spki" });
    return verify(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}

export function shortWallet(wallet: string): string {
  return wallet.length > 12 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
}
