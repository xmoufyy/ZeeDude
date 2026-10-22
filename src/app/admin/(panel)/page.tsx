import Link from "next/link";
import { Suspense } from "react";
import { refreshAction, setMaskingAction } from "../actions";
import { ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPeriodDate } from "@/lib/period";
import { getConfiguredProvider } from "@/lib/providers";
import { normalizeUsername } from "@/lib/ranking";
import { getProviderStatus } from "@/lib/refresh";
import { formatSol } from "@/lib/sol";
import { shortWallet } from "@/lib/solana-auth";

const SOURCE_LABELS: Record<string, string> = {
  manual: "File import & manual entry",
  api: "SolPump API (stub)",
};

function configuredProviderKind(): string {
  try {
    return getConfiguredProvider().kind;
  } catch {
    return "invalid DATA_PROVIDER";
  }
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requireAdmin();
  const now = new Date();
  const providerKind = configuredProviderKind();
  const [current, masking, unpaid, excludedCount, status] = await Promise.all([
    db.period.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now }, finalizedAt: null },
      include: { _count: { select: { entries: true } } },
    }),
    db.setting.findUnique({ where: { key: "maskUsernames" } }),
    db.payout.findMany({ where: { paid: false }, include: { period: { select: { name: true } } }, orderBy: { rank: "asc" } }),
    db.excludedUser.count(),
    getProviderStatus(),
  ]);
  const pendingClaims = await db.player.count({ where: { solpumpStatus: "pending" } });
  // Verified payout wallets from approved player profiles, for the copy buttons.
  const approvedPlayers = await db.player.findMany({
    where: { solpumpStatus: "approved" },
    select: { solpumpKey: true, wallet: true },
  });
  const walletByKey = new Map(approvedPlayers.map((pl) => [pl.solpumpKey!, pl.wallet]));
  // Periods past their end date that still need to be ended and paid.
  const needsEnding = await db.period.findMany({ where: { endsAt: { lte: now }, finalizedAt: null }, orderBy: { endsAt: "asc" } });
  const masked = masking?.value !== "false";

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Dashboard</h1>

      {pendingClaims > 0 && (
        <div className="rounded-xl border border-cyan/40 bg-cyan/10 p-4 text-sm">
          <p>
            <strong className="text-cyan">{pendingClaims} player profile{pendingClaims === 1 ? "" : "s"}</strong> waiting
            for you to verify their SolPump username.{" "}
            <Link href="/admin/players" className="font-semibold underline-offset-2 hover:underline">
              Review
            </Link>
          </p>
        </div>
      )}

      {needsEnding.length > 0 && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <p className="font-semibold text-gold">Waiting to be ended</p>
          <p className="mt-1 text-muted">These races are over. Import the final totals, then end them to lock in the winners.</p>
          <ul className="mt-2 space-y-1">
            {needsEnding.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/periods/${p.id}`} className="font-semibold text-text underline-offset-2 hover:underline">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <section className="panel space-y-3 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">Current race</h2>
          {current ? (
            <>
              <p className="font-display text-2xl">{current.name}</p>
              <p className="text-sm text-muted">
                {formatPeriodDate(current.startsAt)} → {formatPeriodDate(current.endsAt)}
              </p>
              <p className="text-sm">
                {current._count.entries} players · {formatSol(current.prizePoolSol)} SOL pool · last data update{" "}
                {current.dataUpdatedAt ? formatPeriodDate(current.dataUpdatedAt) : "never"}
              </p>
              <Link href={`/admin/periods/${current.id}`} className="btn btn-primary">
                Import data / edit
              </Link>
            </>
          ) : (
            <>
              <p className="text-muted">No race is running right now.</p>
              <Link href="/admin/periods" className="btn btn-primary">
                Create a period
              </Link>
            </>
          )}
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">Data source</h2>
          <p className="text-sm">
            <strong className="text-gold">{SOURCE_LABELS[providerKind] ?? providerKind}</strong>
            <span className="block text-xs text-muted">
              Last refresh: {status ? formatPeriodDate(status.lastRunAt) : "never"} (runs every 10 min via cron)
            </span>
          </p>
          {status?.lastErrorAt && (!status.lastSuccessAt || status.lastErrorAt > status.lastSuccessAt) && (
            <p className="rounded-lg bg-red-400/10 px-3 py-2 text-xs whitespace-pre-line text-red-300">
              Last refresh failed {formatPeriodDate(status.lastErrorAt)}:{"\n"}
              {status.lastError}
            </p>
          )}
          <ActionForm action={refreshAction} submitLabel="Refresh now" pendingLabel="Refreshing..." variant="plain" />
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">Username privacy</h2>
          <p className="text-sm">
            Public site currently shows{" "}
            <strong className="text-gold">{masked ? "masked names (Ze****an)" : "full usernames"}</strong>.
          </p>
          <ActionForm
            action={setMaskingAction}
            submitLabel={masked ? "Show full usernames" : "Mask usernames"}
            variant="plain"
            confirm={masked ? "Show full usernames publicly on the leaderboard?" : undefined}
          >
            <input type="hidden" name="mask" value={masked ? "false" : "true"} />
          </ActionForm>
        </section>

        <section className="panel space-y-3 p-5">
          <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">Payouts to send</h2>
          {unpaid.length === 0 ? (
            <p className="text-sm text-muted">All locked-in prizes are paid.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {unpaid.slice(0, 8).map((p) => {
                const wallet = walletByKey.get(normalizeUsername(p.username));
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      #{p.rank} {p.username} <span className="text-muted">· {p.period.name}</span>
                      {wallet ? (
                        <span className="mt-0.5 flex items-center gap-2 text-xs">
                          <span className="font-mono text-emerald-300" title={wallet}>
                            {shortWallet(wallet)}
                          </span>
                          <CopyButton value={wallet} label="Copy wallet" description={`${p.username}'s wallet address`} />
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted">No verified wallet yet</span>
                      )}
                    </span>
                    <span className="shrink-0 text-gold">{formatSol(p.amountSol)} SOL</span>
                  </li>
                );
              })}
              {unpaid.length > 8 && <li className="text-muted">...and {unpaid.length - 8} more</li>}
            </ul>
          )}
          <p className="text-xs text-muted">
            {excludedCount} excluded users · <Link href="/admin/users" className="text-cyan hover:underline">manage</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
