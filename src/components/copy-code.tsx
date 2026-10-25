"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    setCopied(false);
    setFailed(false);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-wrap items-stretch overflow-hidden rounded-2xl border-2 border-dashed border-gold/60 bg-ink/60 shadow-[0_0_32px_-14px] shadow-gold">
      <span className="flex flex-1 items-center px-4 py-3 font-display text-2xl tracking-wider text-gold-gradient select-all sm:text-3xl">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy referral code ${code}`}
        className={`inline-flex items-center gap-1.5 px-4 text-sm font-bold transition active:brightness-90 sm:px-5 ${
          copied ? "bg-success/15 text-success" : "bg-gold/15 text-gold hover:bg-gold/25"
        }`}
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {copied ? <path d="M4 10.5l4 4 8-9" /> : <path d="M7 7V4.5A1.5 1.5 0 018.5 3h7A1.5 1.5 0 0117 4.5v7a1.5 1.5 0 01-1.5 1.5H13M4.5 7h7A1.5 1.5 0 0113 8.5v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 15.5v-7A1.5 1.5 0 014.5 7z" />}
        </svg>
        {copied ? "Copied!" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Referral code copied to clipboard" : ""}
      </span>
      {failed && (
        <p role="status" className="basis-full px-4 pb-3 text-xs text-warning">
          <span aria-hidden="true">⚠ </span>Copy was blocked. Select the code above and copy it manually.
        </p>
      )}
    </div>
  );
}
