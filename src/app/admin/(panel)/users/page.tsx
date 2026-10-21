import { Suspense } from "react";
import { excludeUserAction, unexcludeUserAction } from "../../actions";
import { ActionForm } from "@/components/admin/action-form";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPeriodDate } from "@/lib/period";

export default function ExcludedUsersPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <ExcludedUsers />
    </Suspense>
  );
}

async function ExcludedUsers() {
  await requireAdmin();
  const users = await db.excludedUser.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Excluded users</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cheaters, staff, and alts. Excluded players never appear on live leaderboards or win prizes, in any period.
          Already-ended periods keep their locked-in results.
        </p>
      </div>

      <section className="panel space-y-4 p-5" aria-labelledby="exclude-heading">
        <h2 id="exclude-heading" className="font-display text-xl">Exclude a player</h2>
        <ActionForm action={excludeUserAction} submitLabel="Exclude" inline>
          <div className="min-w-48 flex-1">
            <label className="field-label" htmlFor="x-username">SolPump username</label>
            <input id="x-username" name="username" required maxLength={64} className="input" />
          </div>
          <div className="min-w-64 flex-[2]">
            <label className="field-label" htmlFor="x-reason">Reason</label>
            <input id="x-reason" name="reason" required maxLength={200} placeholder="e.g. Alt of SolSurfer" className="input" />
          </div>
        </ActionForm>
      </section>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-line text-xs tracking-widest text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Username</th>
              <th scope="col" className="py-3">Reason</th>
              <th scope="col" className="py-3">Added</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-semibold">{u.username}</td>
                <td className="py-3 text-muted">{u.reason}</td>
                <td className="py-3 text-muted">{formatPeriodDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <ActionForm
                    action={unexcludeUserAction.bind(null, u.id)}
                    submitLabel="Allow again"
                    variant="plain"
                    confirm={`Let ${u.username} appear on leaderboards again?`}
                  />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">Nobody is excluded.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
