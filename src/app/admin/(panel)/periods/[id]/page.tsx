import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  deleteEntryAction,
  deletePeriodAction,
  finalizePeriodAction,
  importEntriesAction,
  reopenPeriodAction,
  saveEntryAction,
  setPayoutPaidAction,
  updatePeriodAction,
} from "../../../actions";
import { ActionForm } from "@/components/admin/action-form";
import { PeriodFields } from "@/components/admin/period-fields";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPeriodDate, toZonedInputValue } from "@/lib/period";
import { normalizeUsername } from "@/lib/ranking";
import { formatSol } from "@/lib/sol";
import { computeStandings, parseSplit } from "@/lib/standings";

export default function PeriodDetailPage({ params }: PageProps<"/admin/periods/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <PeriodDetail params={params} />
    </Suspense>
  );
}

async function PeriodDetail({ params }: Pick<PageProps<"/admin/periods/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const period = await db.period.findUnique({
    where: { id },
    include: { entries: true, payouts: { orderBy: [{ rank: "asc" }, { username: "asc" }] } },
  });
  if (!period) notFound();

  const now = new Date();
  const finalized = period.finalizedAt !== null;
  const [standings, excluded] = await Promise.all([
    computeStandings(period),
    db.excludedUser.findMany({ select: { username: true, reason: true } }),
  ]);
  const entryByKey = new Map(period.entries.map((e) => [normalizeUsername(e.username), e]));
  const excludedByKey = new Map(excluded.map((e) => [e.username, e.reason]));
  const excludedEntries = period.entries.filter((e) => excludedByKey.has(normalizeUsername(e.username)));
  const anyPaid = period.payouts.some((p) => p.paid);
  // Verified payout wallets from approved player profiles.
  const approvedPlayers = finalized
    ? await db.player.findMany({ where: { solpumpStatus: "approved" }, select: { solpumpKey: true, wallet: true } })
    : [];
  const walletByKey = new Map(approvedPlayers.map((pl) => [pl.solpumpKey!, pl.wallet]));

  const statusLabel = finalized
    ? "Ended"
    : period.endsAt <= now
      ? "Over, needs ending"
      : period.startsAt > now
        ? "Scheduled"
        : "Live";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/periods" className="text-sm text-muted hover:text-text">← All periods</Link>
          <h1 className="mt-1 font-display text-3xl">{period.name}</h1>
          <p className="text-sm text-muted">
            {formatPeriodDate(period.startsAt)} → {formatPeriodDate(period.endsAt)} · <strong className="text-text">{statusLabel}</strong>
          </p>
          <p className="text-sm text-muted">
            Data last updated: {period.dataUpdatedAt ? formatPeriodDate(period.dataUpdatedAt) : "never"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={finalized || period.endsAt <= now ? `/history?period=${period.id}` : "/"} className="btn" target="_blank">
            View on site ↗
          </Link>
          {finalized ? (
            <ActionForm
              action={reopenPeriodAction.bind(null, period.id)}
              submitLabel="Reopen"
              variant="plain"
              confirm="Reopen this period? Its locked-in winners and payouts will be cleared."
            />
          ) : (
            <ActionForm
              action={finalizePeriodAction.bind(null, period.id)}
              submitLabel={period.endsAt > now ? "End early & lock winners" : "End & lock winners"}
              pendingLabel="Ending..."
              confirm={
                period.endsAt > now
                  ? "This race is still running. End it NOW and lock in the current standings?"
                  : "Lock in the final standings? Make sure you've imported the final totals first."
              }
            />
          )}
          {!anyPaid && (
            <ActionForm
              action={deletePeriodAction.bind(null, period.id)}
              submitLabel="Delete"
              variant="danger"
              confirm={`Permanently delete "${period.name}" and all its wager data?`}
            />
          )}
        </div>
      </div>

      {finalized && (
        <section className="panel space-y-4 p-5" aria-labelledby="payouts-heading">
          <h2 id="payouts-heading" className="font-display text-xl">Payouts</h2>
          {period.payouts.length === 0 ? (
            <p className="text-sm text-muted">No winners were locked in for this period.</p>
          ) : (
            <ul className="divide-y divide-line">
              {period.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="w-10 font-display text-muted">#{p.rank}</span>
                  <span className="min-w-32 flex-1 font-semibold">
                    {p.username}
                    {walletByKey.get(normalizeUsername(p.username)) ? (
                      <span className="block font-mono text-xs font-normal text-emerald-300" title="Verified payout wallet">
                        ✓ {walletByKey.get(normalizeUsername(p.username))}
                      </span>
                    ) : (
                      <span className="block text-xs font-normal text-muted">No verified profile wallet</span>
                    )}
                  </span>
                  <span className="w-28 text-gold tabular-nums">{formatSol(p.amountSol)} SOL</span>
                  {p.paid ? (
                    <div className="flex flex-1 flex-wrap items-center gap-3 text-sm">
                      <span className="text-emerald-300">✓ Paid {p.paidAt ? formatPeriodDate(p.paidAt) : ""}</span>
                      {p.txNote && <span className="text-muted">“{p.txNote}”</span>}
                      <ActionForm action={setPayoutPaidAction.bind(null, p.id)} submitLabel="Mark unpaid" variant="plain" inline confirm="Mark this prize as NOT paid?">
                        <input type="hidden" name="paid" value="false" />
                        <input type="hidden" name="txNote" value={p.txNote ?? ""} />
                      </ActionForm>
                    </div>
                  ) : (
                    <ActionForm action={setPayoutPaidAction.bind(null, p.id)} submitLabel="Mark paid" inline className="flex-1">
                      <input type="hidden" name="paid" value="true" />
                      <label className="sr-only" htmlFor={`note-${p.id}`}>Transaction note for {p.username}</label>
                      <input id={`note-${p.id}`} name="txNote" placeholder="Tx signature or note" maxLength={500} className="input min-w-48 flex-1" />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!finalized && (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <section className="panel space-y-4 p-5" aria-labelledby="import-heading">
            <h2 id="import-heading" className="font-display text-xl">Import wager data</h2>
            <p className="text-sm text-muted">
              Upload a CSV or JSON export with a username column and a SOL wagered column (e.g.{" "}
              <code className="text-text">username,wagered</code>). A USD column is optional. Max 2 MB.
            </p>
            <ActionForm action={importEntriesAction.bind(null, period.id)} submitLabel="Import" pendingLabel="Importing...">
              <div>
                <label className="field-label" htmlFor="file">File</label>
                <input id="file" name="file" type="file" accept=".csv,.json,text/csv,application/json" className="input file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-text" />
              </div>
              <div>
                <label className="field-label" htmlFor="pasted">…or paste CSV / JSON</label>
                <textarea id="pasted" name="pasted" rows={4} className="input font-mono text-xs" placeholder={"username,wagered\nSolSurfer,12.5\nDegenDave,8.25"} />
              </div>
              <fieldset className="space-y-2 text-sm">
                <legend className="field-label">Mode</legend>
                <label className="flex items-start gap-2">
                  <input type="radio" name="mode" value="replace" defaultChecked className="mt-1 accent-[var(--color-gold)]" />
                  <span><strong>Replace</strong>: the file is the full leaderboard. Players not in the file are removed.</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="mode" value="merge" className="mt-1 accent-[var(--color-gold)]" />
                  <span><strong>Merge</strong>: update players in the file, keep everyone else as is.</span>
                </label>
              </fieldset>
            </ActionForm>
          </section>

          <section className="panel space-y-4 p-5" aria-labelledby="manual-heading">
            <h2 id="manual-heading" className="font-display text-xl">Add or update a player</h2>
            <p className="text-sm text-muted">If the username already exists in this period, its total is replaced.</p>
            <ActionForm action={saveEntryAction.bind(null, period.id)} submitLabel="Save player">
              <div>
                <label className="field-label" htmlFor="m-username">Username</label>
                <input id="m-username" name="username" required maxLength={64} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="m-sol">Wagered (SOL)</label>
                  <input id="m-sol" name="wageredSol" type="number" min="0" step="any" required className="input" />
                </div>
                <div>
                  <label className="field-label" htmlFor="m-usd">Wagered (USD, optional)</label>
                  <input id="m-usd" name="wageredUsd" type="number" min="0" step="any" className="input" />
                </div>
              </div>
            </ActionForm>
          </section>
        </div>
      )}

      <section className="space-y-3" aria-labelledby="standings-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="standings-heading" className="font-display text-xl">{finalized ? "Live data (locked results above)" : "Standings preview"}</h2>
          <p className="text-sm text-muted">{standings.length} ranked · real usernames (admins only)</p>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-xs tracking-widest text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">Rank</th>
                <th scope="col" className="py-3">Username</th>
                <th scope="col" className="py-3">Wagered (SOL)</th>
                <th scope="col" className="py-3 text-right">Prize</th>
                <th scope="col" className="py-3 pl-4">Source</th>
                <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {standings.map((s) => {
                const entry = entryByKey.get(normalizeUsername(s.username));
                return (
                  <tr key={s.username} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-2 font-display text-muted">{s.rank}</td>
                    <td className="py-2 font-medium">{s.username}</td>
                    <td className="py-2">
                      {finalized ? (
                        <span className="tabular-nums">{formatSol(s.wageredSol)}</span>
                      ) : (
                        <ActionForm action={saveEntryAction.bind(null, period.id)} submitLabel="Save" variant="plain" inline>
                          <input type="hidden" name="username" value={s.username} />
                          <input type="hidden" name="wageredUsd" value={entry?.wageredUsd ?? ""} />
                          <label className="sr-only" htmlFor={`w-${s.username}`}>Wagered SOL for {s.username}</label>
                          <input
                            id={`w-${s.username}`}
                            name="wageredSol"
                            type="number"
                            min="0"
                            step="any"
                            defaultValue={s.wageredSol}
                            className="input w-32 py-1"
                          />
                        </ActionForm>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gold">{s.prizeSol > 0 ? `${formatSol(s.prizeSol)} SOL` : "—"}</td>
                    <td className="py-2 pl-4 text-xs text-muted">{entry?.source}</td>
                    <td className="px-4 py-2 text-right">
                      {!finalized && entry && (
                        <ActionForm
                          action={deleteEntryAction.bind(null, entry.id)}
                          submitLabel="Remove"
                          variant="danger"
                          confirm={`Remove ${s.username} from this period?`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {excludedEntries.map((e) => (
                <tr key={e.id} className="bg-red-400/[0.04] text-muted">
                  <td className="px-4 py-2">—</td>
                  <td className="py-2">
                    {e.username}{" "}
                    <span className="ml-1 rounded bg-red-400/15 px-1.5 py-0.5 text-xs text-red-300">
                      Excluded: {excludedByKey.get(normalizeUsername(e.username))}
                    </span>
                  </td>
                  <td className="py-2 tabular-nums">{formatSol(e.wageredSol)}</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 pl-4 text-xs">{e.source}</td>
                  <td className="px-4 py-2 text-right">
                    {!finalized && (
                      <ActionForm action={deleteEntryAction.bind(null, e.id)} submitLabel="Remove" variant="danger" confirm={`Remove ${e.username}?`} />
                    )}
                  </td>
                </tr>
              ))}
              {standings.length === 0 && excludedEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">No wager data yet. Import a file or add players above.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel space-y-4 p-5" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="font-display text-xl">Period settings</h2>
        {finalized && <p className="text-sm text-muted">This period has ended. Reopen it to change dates or prizes.</p>}
        <ActionForm action={updatePeriodAction.bind(null, period.id)} submitLabel="Save settings">
          <PeriodFields
            disabled={finalized}
            defaults={{
              name: period.name,
              startsAt: toZonedInputValue(period.startsAt),
              endsAt: toZonedInputValue(period.endsAt),
              prizePoolSol: period.prizePoolSol,
              payoutSplit: parseSplit(period.payoutSplit),
            }}
          />
        </ActionForm>
      </section>
    </div>
  );
}
