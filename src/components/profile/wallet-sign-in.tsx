"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { finishSignInAction, startSignInAction } from "@/app/profile/actions";

// Talks to injected wallet extensions directly (Phantom, Solflare, Backpack
// all expose connect() + signMessage()), so no wallet SDK is bundled.

type SignResult = Uint8Array | { signature: Uint8Array };
type InjectedWallet = {
  connect(): Promise<{ publicKey?: { toString(): string } } | void>;
  publicKey?: { toString(): string } | null;
  signMessage(message: Uint8Array, encoding?: string): Promise<SignResult>;
};
type WalletOption = { name: string; provider: InjectedWallet };

declare global {
  interface Window {
    phantom?: { solana?: InjectedWallet };
    solflare?: InjectedWallet;
    backpack?: InjectedWallet;
    solana?: InjectedWallet;
  }
}

function detectWallets(): WalletOption[] {
  const found: WalletOption[] = [];
  const add = (name: string, provider: InjectedWallet | undefined) => {
    if (provider && typeof provider.signMessage === "function" && !found.some((f) => f.provider === provider)) {
      found.push({ name, provider });
    }
  };
  add("Phantom", window.phantom?.solana);
  add("Solflare", window.solflare);
  add("Backpack", window.backpack);
  add("Solana wallet", window.solana);
  return found;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function WalletSignIn() {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extensions can inject after the page loads, so keep looking for a few seconds.
    const timers = [250, 1000, 2500].map((ms, i, all) =>
      setTimeout(() => {
        const found = detectWallets();
        if (found.length > 0 || i === all.length - 1) setWallets(found);
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  async function signIn({ name, provider }: WalletOption) {
    setBusy(name);
    setError(null);
    try {
      const connected = await provider.connect();
      const wallet = (connected && connected.publicKey ? connected.publicKey : provider.publicKey)?.toString();
      if (!wallet) throw new Error("The wallet didn't share an address.");

      const step = await startSignInAction(wallet);
      if (!step.ok) throw new Error(step.error);

      const signed = await provider.signMessage(new TextEncoder().encode(step.message), "utf8");
      const signature = signed instanceof Uint8Array ? signed : signed.signature;
      const result = await finishSignInAction(wallet, step.nonce, toBase64(signature));
      if (!result.ok) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(/reject|cancel|denied/i.test(message) ? "Sign-in was cancelled in your wallet." : message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {wallets === null ? (
        <p className="text-sm text-muted">Looking for your wallet…</p>
      ) : wallets.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {wallets.map((w) => (
            <button key={w.name} type="button" onClick={() => signIn(w)} disabled={!!busy} className="btn btn-primary px-5 py-3 text-base">
              {busy === w.name ? "Check your wallet…" : `Sign in with ${w.name}`}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted">
          No Solana wallet found in this browser. Install{" "}
          <a href="https://phantom.com/download" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
            Phantom
          </a>{" "}
          or{" "}
          <a href="https://solflare.com/download" target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
            Solflare
          </a>
          , then reload this page. On mobile, open this page inside your wallet app&apos;s browser.
        </div>
      )}
      <p className="text-xs text-muted">
        Signing a message only proves you own the wallet. It never sends a transaction or costs anything.
      </p>
      <div aria-live="polite">
        {error && <p className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}
