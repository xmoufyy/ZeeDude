import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-24 text-center">
      <p className="font-display text-7xl text-gold-gradient">404</p>
      <h1 className="font-display text-2xl">Page not found</h1>
      <p className="text-muted">That page doesn&apos;t exist, or the race you&apos;re looking for has moved.</p>
      <Link href="/" className="btn btn-primary">
        Back to the leaderboard
      </Link>
    </div>
  );
}
