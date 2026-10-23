import Image from "next/image";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyCode } from "@/components/copy-code";
import { Countdown } from "@/components/countdown";
import { JoinCard } from "@/components/join-card";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Podium } from "@/components/podium";
import { PrizeBreakdown } from "@/components/prize-breakdown";
import { DelayedNotice } from "@/components/delayed-notice";
import { GameRules } from "@/components/game-rules";
import { assessFreshness, staleAfterMs } from "@/lib/freshness";
import { requestNow } from "@/lib/request-time";
import { formatPeriodDate } from "@/lib/period";
import { loadCurrentLeaderboard } from "@/lib/public-data";
import { site } from "@/lib/site";
import { formatSol } from "@/lib/sol";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 pt-8 sm:pt-12">
      <Suspense fallback={<BoardSkeleton />}>
        <CurrentBoard />
      </Suspense>
      <JoinCard />
    </div>
  );
}

async function CurrentBoard() {
  const serverNow = await requestNow();
  const loaded = await loadCurrentLeaderboard();
  const board = loaded.value;

  if (!board) {
    return (
      <>
        <Hero />
        <p className="panel px-5 py-10 text-center text-muted">The first race hasn&apos;t been scheduled yet. Check back soon!</p>
      </>
    );
  }

  const { period, rows, prizes } = board;
  // A scheduled race has no standings yet: wagers only count once it starts.
  const notStarted = Date.parse(period.startsAt) > serverNow;
  const freshness = assessFreshness({
    now: serverNow,
    fromFallback: loaded.fromFallback,
    fallbackSavedAt: loaded.fromFallback ? loaded.savedAt : undefined,
    live: !notStarted && !period.finalized && Date.parse(period.endsAt) > serverNow,
    dataUpdatedAt: board.dataUpdatedAt,
    source: board.source,
    staleAfterMs: staleAfterMs(),
  });

  return (
    <>
      <Hero>
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-4xl text-shine sm:text-5xl">{formatSol(period.prizePoolSol)} SOL</span>
            <span className="text-sm font-semibold tracking-[0.2em] text-muted uppercase">Weekly prize pool</span>
          </div>
          <Countdown startsAt={period.startsAt} endsAt={period.endsAt} serverNow={serverNow} />
          <p className="text-sm text-muted">
            <time dateTime={period.startsAt}>{formatPeriodDate(period.startsAt)}</time>
            {" → "}
            <time dateTime={period.endsAt}>{formatPeriodDate(period.endsAt)}</time>
          </p>
        </div>
      </Hero>

      <section aria-labelledby="board-heading" className="space-y-8">
        <DelayedNotice freshness={freshness} />
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 id="board-heading" className="font-display text-2xl sm:text-3xl">
              {notStarted ? (
                <>
                  Next <span className="text-gold-gradient">Race</span>
                </>
              ) : (
                <>
                  This Week&apos;s <span className="text-gold-gradient">Leaderboard</span>
                </>
              )}
            </h2>
            <GameRules />
          </div>
          {!notStarted && (
            <>
              <p className="text-muted">
                {board.playerCount} {board.playerCount === 1 ? "player" : "players"} ·{" "}
                {formatSol(board.totalWageredSol, { max: 2 })} SOL wagered
              </p>
              <AutoRefresh updatedAt={board.dataUpdatedAt} serverNow={serverNow} />
            </>
          )}
        </div>
        {notStarted ? (
          <p className="panel px-5 py-10 text-center text-muted">
            The race starts <time dateTime={period.startsAt}>{formatPeriodDate(period.startsAt)}</time>. The leaderboard opens then, and
            only wagers placed from that moment count.
          </p>
        ) : (
          <>
            <div className="pt-6">
              <Podium rows={rows} />
            </div>
            <LeaderboardTable rows={rows.slice(3)} caption={`${period.name} rankings, 4th place and below`} />
          </>
        )}
      </section>

      <PrizeBreakdown prizes={prizes} poolSol={period.prizePoolSol} />
    </>
  );
}

function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <section className="grid items-center gap-8 md:grid-cols-[1fr_auto]" aria-labelledby="hero-heading">
      <div className="space-y-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-magenta/40 bg-magenta/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-magenta uppercase">
          ZeeDude × SolPump weekly race
        </p>
        <h1 id="hero-heading" className="font-display text-4xl leading-[1.05] sm:text-6xl">
          <span className="text-gold-gradient">SolPump</span>
          <br />
          Wager Leaderboard
        </h1>
        <div className="flex max-w-sm flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Use code</span>
          <CopyCode code={site.referralCode} />
        </div>
        {children}
      </div>
      <div className="relative mx-auto hidden w-72 md:block lg:w-96" aria-hidden="true">
        <div className="absolute inset-6 rounded-full bg-violet/40 blur-3xl" />
        <Image
          src="/brand/zeedude-logo.webp"
          alt=""
          width={384}
          height={384}
          sizes="(min-width: 1024px) 384px, 288px"
          className="relative rounded-full"
          priority
        />
      </div>
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-12" aria-busy="true" aria-label="Loading leaderboard">
      <Hero>
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      </Hero>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
