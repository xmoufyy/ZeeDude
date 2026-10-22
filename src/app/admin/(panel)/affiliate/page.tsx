import { Suspense } from "react";
import { deleteAffiliateSnapshotAction } from "../../actions";
import { ActionForm } from "@/components/admin/action-form";
import { AffiliateImportForm } from "@/components/admin/affiliate-import-form";
import { recentAffiliateSnapshots } from "@/lib/affiliate-import";
import { requireAdmin } from "@/lib/auth";
import { formatPeriodDate } from "@/lib/period";

export default function AffiliateImportPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <AffiliateImport />
    </Suspense>
  );
}

async function AffiliateImport() {
  await requireAdmin();
  const snapshots = await recentAffiliateSnapshots();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">SolPump import</h1>
        <div className="mt-2 max-w-2xl space-y-2 text-sm text-muted">
          <p>
            SolPump&apos;s affiliate page shows each player&apos;s <strong className="text-text">all-time</strong> wagered total. Paste a
            copy of it here and the site works out each week&apos;s wagers: the latest copy minus the copy taken closest to the week&apos;s
            start.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-text">Every Sunday at 5 PM ET:</strong> paste a copy. It closes out the old week and is the starting
              point for the new one. Within an hour either side is fine.
            </li>
            <li>
              <strong className="text-text">During the week:</strong> paste a fresh copy whenever you want the leaderboard updated.
            </li>
            <li>Make sure the copy includes every page of the list. Use Preview to check before saving.</li>
          </ul>
        </div>
      </div>

      <section className="panel p-5" aria-label="Paste the affiliate list">
        <AffiliateImportForm />
      </section>

      <section className="space-y-3" aria-labelledby="copies-heading">
        <h2 id="copies-heading" className="font-display text-xl">Saved copies</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-line text-xs tracking-widest text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">Copied at</th>
                <th scope="col" className="py-3">Players</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{formatPeriodDate(s.takenAt)}</td>
                  <td className="py-3 text-muted">{s.players}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionForm
                      action={deleteAffiliateSnapshotAction.bind(null, s.id)}
                      submitLabel="Delete"
                      pendingLabel="Deleting..."
                      variant="plain"
                      confirm="Delete this copy? Open leaderboards that used it will be recalculated."
                    />
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-muted">No copies yet. Paste the affiliate list above to start.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
