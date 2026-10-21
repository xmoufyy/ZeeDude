import Link from "next/link";
import { Suspense } from "react";
import { refreshAction, setMaskingAction } from "../actions";
import { ActionForm } from "@/components/admin/action-form";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPeriodDate } from "@/lib/period";
import { formatSol } from "@/lib/sol";

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
  const [current, masking, unpaid, excludedCount] = await Promise.all([
    db.period.findFirst({
      where: { startsAt: { lte: now }, endsAt: { gt: now }, finalizedAt: null },
      include: { _count: { select: { entries: true } } },
    }),
    db.setting.findUnique({ where: { key: "maskUsernames" } }),
    db.payout.findMany({ where: { paid: false }, include: { period: { select: { name: true } } }, orderBy: { rank: "asc" } }),
    db.excludedUser.count(),
  ]);
  // Periods past their end date that still need to be ended and paid.
  const needsEnding = await db.period.findMany({ where: { endsAt: { lte: now }, finalizedAt: null }, orderBy: { endsAt: "asc" } });
  const masked = masking?.value !== "false";

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Dashboard</h1>

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
          <h2 className="text-sm font-semibold tracking-widest text-muted uppercase">Refresh</h2>
          <p className="text-sm text-muted">Clears the cache so the public site shows the latest data immediately.</p>
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
            <ul className="space-y-1 text-sm">
              {unpaid.slice(0, 8).map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>
                    #{p.rank} {p.username} <span className="text-muted">· {p.period.name}</span>
                  </span>
                  <span className="text-gold">{formatSol(p.amountSol)} SOL</span>
                </li>
              ))}
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
