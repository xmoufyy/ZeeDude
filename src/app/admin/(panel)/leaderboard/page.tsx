import Link from "next/link";
import { Suspense } from "react";
import { StandingsExplorer } from "@/components/admin/standings-explorer";
import { type AdminPeriodStatus, adminStandings, periodStatus } from "@/lib/admin-leaderboard";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessFreshness, staleAfterMs } from "@/lib/freshness";
import { formatPeriodDate, formatPeriodRange } from "@/lib/period";
import { getProviderStatus } from "@/lib/refresh";
import { formatSol } from "@/lib/sol";

const STATUS_BADGE: Record<AdminPeriodStatus, { label: string; className: string; icon: string }> = {
  live: { label: "Live", className: "badge-success", icon: "●" },
  scheduled: { label: "Scheduled", className: "badge-info", icon: "◷" },
  "needs-ending": { label: "Needs ending", className: "badge-warning", icon: "⚠" },
  ended: { label: "Ended", className: "badge-neutral", icon: "✓" },
};

export default function AdminLeaderboardPage({ searchParams }: PageProps<"/admin/leaderboard">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <LeaderboardControl searchParams={searchParams} />
    </Suspense>
  );
}

function ago(iso: Date, now: Date) {
  const minutes = Math.round((now.getTime() - iso.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hr${hours === 1 ? "" : "s"} ago` : `${Math.round(hours / 24)} days ago`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

async function LeaderboardControl({ searchParams }: Pick<PageProps<"/admin/leaderboard">, "searchParams">) {
  await requireAdmin();
  const { period: requested, q } = await searchParams;
  const now = new Date();
  const [periods, source] = await Promise.all([
    db.period.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { entries: true } } } }),
    getProviderStatus(),
  ]);

  if (periods.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Leaderboard</h1>
        <p className="panel p-6 text-muted">
          No periods yet.{" "}
          <Link href="/admin/periods" className="text-cyan hover:underline">
            Create the first race
          </Link>
          .
        </p>
      </div>
    );
  }

  // Default to the race running now, else the most recent one that has started.
  const selected =
    periods.find((p) => p.id === requested) ??
    periods.find((p) => periodStatus(p, now) === "live") ??
    periods.find((p) => p.startsAt <= now) ??
    periods[0];
  const status = periodStatus(selected, now);
  const locked = status === "ended";
  const rows = await adminStandings(selected);
  const totalWagered = rows.reduce((sum, r) => sum + r.wageredSol, 0);
  const winners = rows.filter((r) => r.paid !== undefined);
  const paidCount = winners.filter((r) => r.paid).length;
  const exportHref = (format: "csv" | "json") => `/admin/leaderboard/export?period=${selected.id}&format=${format}`;

  const freshness = assessFreshness({
    now: now.getTime(),
    fromFallback: false,
    live: status === "live",
    dataUpdatedAt: selected.dataUpdatedAt?.toISOString() ?? null,
    source,
    staleAfterMs: staleAfterMs(),
  });
  const health =
    status === "ended"
      ? { className: "badge-neutral", icon: "✓", label: "Final results locked" }
      : status === "needs-ending"
        ? { className: "badge-warning", icon: "⚠", label: "Race over: end it to lock winners" }
        : status === "scheduled"
          ? { className: "badge-info", icon: "◷", label: `Starts ${formatPeriodDate(selected.startsAt)}` }
          : !selected.dataUpdatedAt
            ? { className: "badge-warning", icon: "⚠", label: "No wager data imported yet" }
            : freshness.delayed && freshness.reason === "source"
              ? { className: "badge-danger", icon: "✕", label: "Data source refresh failing" }
              : freshness.delayed
                ? { className: "badge-warning", icon: "⚠", label: "Data is stale: import a new copy" }
                : { className: "badge-success", icon: "●", label: "Data fresh" };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Operations / leaderboard</p>
          <h1 className="font-display text-3xl">Leaderboard control</h1>
          <p className="text-sm text-muted">Real usernames, every round, search and exports in one place.</p>
        </div>
        <span className={`badge ${health.className} px-3 py-1 text-sm`} role="status">
          <span aria-hidden="true">{health.icon}</span> {health.label}
        </span>
      </header>

      <section aria-labelledby="round-heading" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="round-heading" className="section-title">
                {selected.name}
              </h2>
              <span className={`badge ${STATUS_BADGE[status].className}`}>
                <span aria-hidden="true">{STATUS_BADGE[status].icon}</span> {STATUS_BADGE[status].label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatPeriodDate(selected.startsAt)} → {formatPeriodDate(selected.endsAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/periods/${selected.id}`} className="btn">
              Edit period
            </Link>
            <a href={exportHref("csv")} className="btn" download>
              Export CSV
            </a>
            <a href={exportHref("json")} className="btn" download>
              Export JSON
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Players" value={String(rows.length)} note={locked ? "in the final results" : "ranked right now"} />
          <Stat label="Total wagered" value={`${formatSol(totalWagered, { max: 2 })} SOL`} />
          <Stat
            label={locked ? "Prizes paid" : "Prize pool"}
            value={locked ? `${paidCount} / ${winners.length}` : `${formatSol(selected.prizePoolSol)} SOL`}
            note={locked ? `${formatSol(selected.prizePoolSol)} SOL pool` : undefined}
          />
          <Stat
            label="Wager data as of"
            value={selected.dataUpdatedAt ? ago(selected.dataUpdatedAt, now) : "Never"}
            note={selected.dataUpdatedAt ? formatPeriodDate(selected.dataUpdatedAt) : "Import a SolPump copy or a file"}
          />
        </div>
      </section>

      {rows.length > 0 && (
        <section aria-labelledby="top-heading" className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="top-heading" className="font-display text-xl">
              {locked ? "Final top 10" : "Current top 10"}
            </h2>
            <p className="text-xs text-muted">Real usernames (admins only)</p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {rows.slice(0, 10).map((r) => (
              <li key={`${r.rank}-${r.username}`} className="flex items-center gap-3 rounded-xl border border-line bg-ink/45 px-3 py-2">
                <span className={`w-8 font-display ${r.rank <= 3 ? "text-gold" : "text-muted"}`}>#{r.rank}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.username}</span>
                <span className="text-sm tabular-nums">{formatSol(r.wageredSol, { min: 2, max: 2 })} SOL</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="standings-heading" className="space-y-3">
        <h2 id="standings-heading" className="font-display text-xl">
          {locked ? "Final standings" : "Full standings"}
        </h2>
        <StandingsExplorer key={selected.id} rows={rows} locked={locked} initialQuery={typeof q === "string" ? q : ""} />
      </section>

      <section aria-labelledby="rounds-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="rounds-heading" className="font-display text-xl">
            All rounds
          </h2>
          <p className="text-xs text-muted">Ended rounds show their locked final snapshot</p>
        </div>
        <ul className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((p) => {
            const s = periodStatus(p, now);
            const active = p.id === selected.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/leaderboard?period=${p.id}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`block h-full rounded-xl border px-4 py-3 transition ${
                    active ? "border-gold/50 bg-gold/10" : "border-line bg-panel/60 hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${active ? "text-gold" : ""}`}>{p.name}</span>
                    <span className={`badge ${STATUS_BADGE[s].className}`}>{STATUS_BADGE[s].label}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {formatPeriodRange(p.startsAt, p.endsAt)} · {p._count.entries} entries · {formatSol(p.prizePoolSol)} SOL pool
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
