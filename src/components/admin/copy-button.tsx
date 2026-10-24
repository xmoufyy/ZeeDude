"use client";

import { useState } from "react";

/** Small button that copies `value` to the clipboard and confirms briefly. */
export function CopyButton({ value, label = "Copy", description }: { value: string; label?: string; description: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    setCopied(false);
    setFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        title={value}
        aria-label={`${label}: ${description}`}
        className={`rounded-md border px-2 py-0.5 text-xs font-semibold transition ${
          copied ? "border-emerald-400/50 text-emerald-300" : "border-line text-cyan hover:border-cyan/50"
        }`}
      >
        {copied ? "Copied!" : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `Copied ${description}` : ""}
      </span>
      {failed && <span role="status" className="text-xs text-amber-200">Copy blocked. Select and copy manually: <span className="break-all select-all">{value}</span></span>}
    </>
  );
}
