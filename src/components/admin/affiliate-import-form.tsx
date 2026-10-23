"use client";

import { useActionState } from "react";
import { affiliateImportAction, type AffiliatePeriodPreview } from "@/app/admin/actions";
import { ResultMessage } from "@/components/admin/action-form";
import { formatPeriodDate } from "@/lib/period";
import { formatSol } from "@/lib/sol";

/** Paste box for SolPump's affiliate list, with a preview before saving. */
export function AffiliateImportForm() {
  const [state, formAction, pending] = useActionState(affiliateImportAction, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const intent = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
        if (intent === "save" && !window.confirm("Save this copy? Open leaderboards it affects will be recalculated from SolPump totals, replacing their current rows.")) {
          e.preventDefault();
        }
      }}
      className="space-y-4"
    >
      <div>
        <label className="field-label" htmlFor="aff-paste">Affiliate list</label>
        <textarea
          id="aff-paste"
          name="paste"
          required
          rows={10}
          className="input font-mono text-xs"
          placeholder={"Select the whole referral list on SolPump's affiliate page, copy it, and paste it here.\n\nNoahReapwe\nWagered\n559.0603\n..."}
        />
      </div>
      <div className="max-w-xs">
        <label className="field-label" htmlFor="aff-taken">Copied at (Eastern Time, optional)</label>
        <input id="aff-taken" name="takenAt" type="datetime-local" className="input" />
        <p className="mt-1 text-xs text-muted">Leave blank if you copied it just now.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="preview" className="btn" disabled={pending}>
          {pending ? "Working..." : "Preview"}
        </button>
        <button type="submit" name="intent" value="save" className="btn btn-primary" disabled={pending}>
          Save copy
        </button>
      </div>
      <ResultMessage state={state} />
      {state?.periods?.map((p) => <PeriodPreview key={p.periodName} preview={p} />)}
    </form>
  );
}

function PeriodPreview({ preview: p }: { preview: AffiliatePeriodPreview }) {
  return (
    <div className="panel space-y-3 p-4">
      <div>
        <h3 className="font-semibold">{p.periodName}</h3>
        <p className="text-sm text-muted">
          {p.baselineAt
            ? `Comparing the copy from ${formatPeriodDate(p.baselineAt)} with ${p.latestAt ? formatPeriodDate(p.latestAt) : "-"}: ${p.players} players, ${formatSol(p.totalSol, { max: 2 })} SOL wagered.`
            : "This copy is the race's starting point, so its leaderboard isn't changed yet. Totals show up after the next copy."}
        </p>
      </div>
      {p.warnings.length > 0 && (
        <ul className="list-disc space-y-1 rounded-lg bg-amber-400/10 py-2 pr-3 pl-7 text-xs text-amber-200">
          {p.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {p.top.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-xs tracking-widest text-muted uppercase">
            <tr>
              <th scope="col" className="py-1">Player</th>
              <th scope="col" className="py-1 text-right">This period</th>
              <th scope="col" className="py-1 text-right">All time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {p.top.map((r) => (
              <tr key={r.username}>
                <td className="py-1.5">{r.username}</td>
                <td className="py-1.5 text-right font-semibold">{formatSol(r.wageredSol)}</td>
                <td className="py-1.5 text-right text-muted">{formatSol(r.lifetimeSol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {p.players > p.top.length && <p className="text-xs text-muted">Top {p.top.length} of {p.players} shown.</p>}
    </div>
  );
}
