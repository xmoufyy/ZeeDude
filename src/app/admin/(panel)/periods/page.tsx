import Link from "next/link";
import { Suspense } from "react";
import { createPeriodAction } from "../../actions";
import { ActionForm } from "@/components/admin/action-form";
import { PeriodFields } from "@/components/admin/period-fields";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPeriodDate, formatPeriodRange, toZonedInputValue, weeklyWindow } from "@/lib/period";
import { formatSol } from "@/lib/sol";
import { parseSplit } from "@/lib/standings";

const DEFAULT_SPLIT = [40, 20, 12, 8, 6, 4, 3, 3, 2, 2];

export default function PeriodsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <Periods />
    </Suspense>
  );
}

function status(p: { startsAt: Date; endsAt: Date; finalizedAt: Date | null }, now: Date) {
  if (p.finalizedAt) return { label: "Ended", className: "bg-white/10 text-muted" };
  if (p.endsAt <= now) return { label: "Needs ending", className: "bg-gold/15 text-gold" };
  if (p.startsAt > now) return { label: "Scheduled", className: "bg-cyan/15 text-cyan" };
  return { label: "Live", className: "bg-emerald-400/15 text-emerald-300" };
}

async function Periods() {
  await requireAdmin();
  const now = new Date();
  const periods = await db.period.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { entries: true } }, payouts: { select: { paid: true } } },
  });

  // Suggest the next free week, copying the latest period's prize setup.
  const latest = periods[0];
  const next = weeklyWindow(latest && latest.endsAt > now ? latest.endsAt : now);
  const defaults = {
    name: `Week of ${next.start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`,
    startsAt: toZonedInputValue(next.start),
    endsAt: toZonedInputValue(next.end),
    prizePoolSol: latest?.prizePoolSol ?? 10,
    payoutSplit: latest ? parseSplit(latest.payoutSplit) : DEFAULT_SPLIT,
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl">Periods</h1>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line text-xs tracking-widest text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Period</th>
              <th scope="col" className="py-3">Status</th>
              <th scope="col" className="py-3 text-right">Players</th>
              <th scope="col" className="py-3 text-right">Pool</th>
              <th scope="col" className="px-4 py-3 text-right">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {periods.map((p) => {
              const s = status(p, now);
              const paid = p.payouts.filter((x) => x.paid).length;
              return (
                <tr key={p.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/admin/periods/${p.id}`} className="font-semibold hover:text-gold">
                      {p.name}
                    </Link>
                    <span className="block text-xs text-muted">{formatPeriodRange(p.startsAt, p.endsAt)} · ends {formatPeriodDate(p.endsAt)}</span>
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.className}`}>{s.label}</span>
                  </td>
                  <td className="py-3 text-right tabular-nums">{p._count.entries}</td>
                  <td className="py-3 text-right tabular-nums">{formatSol(p.prizePoolSol)} SOL</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.payouts.length ? `${paid}/${p.payouts.length}` : "—"}</td>
                </tr>
              );
            })}
            {periods.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">No periods yet. Create the first one below.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="panel space-y-4 p-5" aria-labelledby="new-period">
        <h2 id="new-period" className="font-display text-xl">New period</h2>
        <ActionForm action={createPeriodAction} submitLabel="Create period" pendingLabel="Creating...">
          <PeriodFields defaults={defaults} />
        </ActionForm>
      </section>
    </div>
  );
}
