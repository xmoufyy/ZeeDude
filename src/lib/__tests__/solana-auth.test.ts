import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken } from "../session";
import { base58Decode, buildSignInMessage, isSolanaAddress, verifyWalletSignature } from "../solana-auth";

// Minimal base58 encoder, test-only, to turn a generated key into an address.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  while (n > BigInt(0)) {
    out = ALPHABET[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

function newWallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return { address: base58Encode(raw), privateKey };
}

describe("base58Decode", () => {
  it("decodes known vectors", () => {
    expect(Buffer.from(base58Decode("2NEpo7TZRRrLZSi2U")!).toString("utf8")).toBe("Hello World!");
    expect(Array.from(base58Decode("1112")!)).toEqual([0, 0, 0, 1]);
    // The System Program address is 32 zero bytes.
    expect(Array.from(base58Decode("11111111111111111111111111111111")!)).toEqual(new Array(32).fill(0));
  });

  it("rejects characters outside the alphabet", () => {
    expect(base58Decode("0OIl")).toBeNull();
    expect(base58Decode("")).toBeNull();
  });
});

describe("isSolanaAddress", () => {
  it("accepts 32-byte base58 keys only", () => {
    expect(isSolanaAddress(newWallet().address)).toBe(true);
    expect(isSolanaAddress("11111111111111111111111111111111")).toBe(true);
    expect(isSolanaAddress("2NEpo7TZRRrLZSi2U")).toBe(false);
    expect(isSolanaAddress("not a wallet")).toBe(false);
  });
});

describe("verifyWalletSignature", () => {
  const message = buildSignInMessage({ domain: "rewards.test", wallet: "W", nonce: "abc", issuedAt: new Date(0) });

  it("accepts the wallet's own signature", () => {
    const { address, privateKey } = newWallet();
    expect(verifyWalletSignature(address, message, sign(null, Buffer.from(message), privateKey))).toBe(true);
  });

  it("rejects another wallet's signature, a changed message, or garbage", () => {
    const a = newWallet();
    const b = newWallet();
    const sig = sign(null, Buffer.from(message), a.privateKey);
    expect(verifyWalletSignature(b.address, message, sig)).toBe(false);
    expect(verifyWalletSignature(a.address, `${message} `, sig)).toBe(false);
    expect(verifyWalletSignature(a.address, message, new Uint8Array(64))).toBe(false);
    expect(verifyWalletSignature(a.address, message, new Uint8Array(10))).toBe(false);
    expect(verifyWalletSignature("bad", message, sig)).toBe(false);
  });

  it("puts the domain, wallet, nonce and time in the message", () => {
    const text = buildSignInMessage({ domain: "x.test", wallet: "ABC", nonce: "n1", issuedAt: new Date("2026-10-21T00:00:00Z") });
    expect(text).toContain("x.test wants you to sign in");
    expect(text).toContain("\nABC\n");
    expect(text).toContain("Nonce: n1");
    expect(text).toContain("Issued At: 2026-10-21T00:00:00.000Z");
  });
});

describe("player session tokens", () => {
  it("carry the wallet as the subject and stay bound to their key", () => {
    const token = createSessionToken("k".repeat(40), 1000, 60_000, "WalletAddr");
    expect(readSessionToken(token, "k".repeat(40), 2000)?.sub).toBe("WalletAddr");
    expect(readSessionToken(token, "other-key".repeat(5), 2000)).toBeNull();
  });
});
