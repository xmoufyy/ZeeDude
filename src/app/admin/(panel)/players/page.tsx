import { Suspense } from "react";
import { reviewClaimAction } from "../../actions";
import { ActionForm } from "@/components/admin/action-form";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPeriodDate } from "@/lib/period";
import { normalizeUsername } from "@/lib/ranking";
import { shortWallet } from "@/lib/solana-auth";

export default function PlayersPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <Players />
    </Suspense>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-gold/15 text-gold",
  approved: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-red-400/15 text-red-300",
  none: "bg-white/10 text-muted",
};

async function Players() {
  await requireAdmin();
  const [players, entries] = await Promise.all([
    db.player.findMany({ orderBy: [{ solpumpStatus: "asc" }, { updatedAt: "desc" }] }),
    // Usernames seen in any imported wager data, to help judge claims.
    db.wagerEntry.findMany({ select: { username: true }, distinct: ["username"] }),
  ]);
  const known = new Set(entries.map((e) => normalizeUsername(e.username)));
  // Pending claims first, then the rest.
  const sorted = [...players].sort((a, b) => Number(b.solpumpStatus === "pending") - Number(a.solpumpStatus === "pending"));
  const pendingCount = players.filter((p) => p.solpumpStatus === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Players</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Profiles created on <span className="text-text">My Profile</span>. Each signed in with their Solana wallet (so the
          wallet is verified). Approve a SolPump username only once you&apos;ve confirmed it&apos;s really theirs, e.g. by
          asking on Discord. Approved players choose whether their name is masked on the leaderboard, and their wallet shows
          next to their payouts.
        </p>
        <p className="mt-2 text-sm">
          <strong className="text-gold">{pendingCount}</strong> pending · {players.length} profiles
        </p>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-line text-xs tracking-widest text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">SolPump username</th>
              <th scope="col" className="py-3">Wallet</th>
              <th scope="col" className="py-3">Socials</th>
              <th scope="col" className="py-3">Name</th>
              <th scope="col" className="py-3">Updated</th>
              <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-4 py-3">
                  <span className="font-semibold">{p.solpumpUsername ?? <span className="text-muted">none</span>}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.solpumpStatus] ?? STATUS_STYLE.none}`}>
                    {p.solpumpStatus}
                  </span>
                  {p.solpumpUsername && (
                    <span className="mt-1 block text-xs text-muted">
                      {known.has(normalizeUsername(p.solpumpUsername)) ? "✓ appears in imported wager data" : "not seen in wager data yet"}
                    </span>
                  )}
                  {p.displayName && <span className="block text-xs text-muted">Display: {p.displayName}</span>}
                </td>
                <td className="py-3 font-mono text-xs" title={p.wallet}>
                  {shortWallet(p.wallet)}
                </td>
                <td className="py-3 text-xs text-muted">
                  {p.discordUsername && <span className="block">Discord: <span className="text-text">{p.discordUsername}</span></span>}
                  {p.kickUsername && <span className="block">Kick: <span className="text-text">{p.kickUsername}</span></span>}
                  {p.xUsername && <span className="block">X: <span className="text-text">@{p.xUsername}</span></span>}
                  {!p.discordUsername && !p.kickUsername && !p.xUsername && "—"}
                </td>
                <td className="py-3 text-xs">{p.hideName ? "Masked" : "Full name"}</td>
                <td className="py-3 text-xs text-muted">{formatPeriodDate(p.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {p.solpumpStatus === "pending" && (
                      <>
                        <ActionForm action={reviewClaimAction.bind(null, p.id, "approve", p.solpumpKey ?? "")} submitLabel="Approve" />
                        <ActionForm
                          action={reviewClaimAction.bind(null, p.id, "reject", p.solpumpKey ?? "")}
                          submitLabel="Reject"
                          variant="danger"
                          confirm={`Reject ${p.solpumpUsername}? The name is freed so someone else can claim it.`}
                        />
                      </>
                    )}
                    {p.solpumpStatus === "approved" && (
                      <ActionForm
                        action={reviewClaimAction.bind(null, p.id, "reset", p.solpumpKey ?? "")}
                        submitLabel="Unverify"
                        variant="plain"
                        confirm={`Move ${p.solpumpUsername} back to pending?`}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">No profiles yet. Players create them on the My Profile page.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
