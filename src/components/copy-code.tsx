"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the code is still visible to copy by hand.
    }
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border-2 border-dashed border-gold/60 bg-ink/60">
      <span className="flex flex-1 items-center px-4 py-3 font-display text-2xl tracking-wider text-gold-gradient sm:text-3xl">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className="bg-gold/15 px-4 text-sm font-bold text-gold transition hover:bg-gold/25 sm:px-5"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Referral code copied to clipboard" : ""}
      </span>
    </div>
  );
}
