import type { Metadata } from "next";
import { Suspense } from "react";
import { signOutAction } from "./actions";
import { ProfileForm } from "@/components/profile/profile-form";
import { WalletSignIn } from "@/components/profile/wallet-sign-in";
import { db } from "@/lib/db";
import { currentPlayerWallet } from "@/lib/player-auth";
import { playerStats } from "@/lib/profile";
import { formatSol } from "@/lib/sol";
import { shortWallet } from "@/lib/solana-auth";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Link your Solana wallet and socials to claim ZeeDude leaderboard prizes.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-8 sm:pt-12">
      <header className="space-y-3 text-center">
        <p className="eyebrow tracking-[0.3em]">ZeeDude Rewards</p>
        <h1 className="font-display text-4xl sm:text-5xl">
          My <span className="text-gold-gradient">Profile</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted">
          Link your wallet and socials once. We use them to verify your spot on the leaderboard and to send your prizes.
        </p>
      </header>
      <Suspense fallback={<div className="panel h-80 animate-pulse" />}>
        <ProfileBody />
      </Suspense>
    </div>
  );
}

function Stat({ label, value, tone = "text-text" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel px-4 py-4 text-center">
      <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-muted uppercase">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

async function ProfileBody() {
  const wallet = await currentPlayerWallet();

  if (!wallet) {
    return (
      <section className="panel space-y-4 p-6 sm:p-8" aria-labelledby="signin-heading">
        <p className="eyebrow">Step 1</p>
        <h2 id="signin-heading" className="font-display text-2xl">
          Connect your wallet
        </h2>
        <p className="text-muted">
          Sign in with the Solana wallet you want prizes sent to. Then add your SolPump username so we can match you to the
          leaderboard.
        </p>
        <WalletSignIn />
      </section>
    );
  }

  const player = await db.player.findUnique({ where: { wallet } });
  if (!player) {
    // Signed session but the profile was removed: start over.
    return (
      <section className="panel space-y-4 p-6">
        <p className="text-muted">We couldn&apos;t find your profile. Please sign in again.</p>
        <WalletSignIn />
      </section>
    );
  }

  const approved = player.solpumpStatus === "approved" && player.solpumpKey;
  const stats = approved ? await playerStats(player.solpumpKey!) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rank this week" value={stats?.rank ? `#${stats.rank}` : "—"} tone="text-gold" />
        <Stat label="Wagered this week" value={stats?.wageredSol != null ? `${formatSol(stats.wageredSol, { max: 2 })} SOL` : "—"} />
        <Stat label="Prizes paid" value={stats ? `${formatSol(stats.wonSol)} SOL` : "—"} tone="text-success" />
        <Stat
          label="Status"
          value={approved ? "Verified" : player.solpumpStatus === "pending" ? "Pending" : player.solpumpStatus === "rejected" ? "Not verified" : "Unlinked"}
          tone={approved ? "text-success" : player.solpumpStatus === "rejected" ? "text-danger" : "text-muted"}
        />
      </div>
      {stats?.rank != null && (
        <p className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-sm">
          {stats.gapSol != null && stats.gapRank != null ? (
            <>
              <span aria-hidden="true">🎯 </span>
              You&apos;re <strong className="text-gold">{formatSol(stats.gapSol, { min: 2, max: 2 })} SOL</strong> behind #{stats.gapRank}.
              Wager more than that to pass them.
            </>
          ) : (
            <>
              <span aria-hidden="true">👑 </span>
              You&apos;re leading this week&apos;s race. Hold the crown!
            </>
          )}
        </p>
      )}
      {stats && stats.pendingSol > 0 && (
        <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          🎉 You have <strong className="text-gold">{formatSol(stats.pendingSol)} SOL</strong> in prizes on the way to{" "}
          <span className="font-mono">{shortWallet(wallet)}</span>.
        </p>
      )}

      <section className="panel space-y-5 p-6 sm:p-8" aria-labelledby="profile-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Profile info</p>
            <h2 id="profile-heading" className="font-display text-2xl">
              {player.displayName ? `Hey, ${player.displayName}` : "Save your reward info"}
            </h2>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="btn">
              Sign out
            </button>
          </form>
        </div>
        <ProfileForm
          wallet={wallet}
          claimStatus={player.solpumpStatus as "none" | "pending" | "approved" | "rejected"}
          values={{
            solpumpUsername: player.solpumpUsername ?? "",
            displayName: player.displayName ?? "",
            discordUsername: player.discordUsername ?? "",
            kickUsername: player.kickUsername ?? "",
            xUsername: player.xUsername ?? "",
            hideName: player.hideName,
          }}
        />
      </section>
    </div>
  );
}
