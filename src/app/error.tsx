"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center">
      <p className="font-display text-5xl text-gold-gradient">Whoops</p>
      <h1 className="font-display text-2xl">Something went wrong</h1>
      <p className="text-muted">The leaderboard hit a snag loading this page. It&apos;s usually temporary.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn">
          Back to the leaderboard
        </Link>
      </div>
      {digest && <p className="text-xs text-muted/70">Error reference: {digest}</p>}
    </div>
  );
}
