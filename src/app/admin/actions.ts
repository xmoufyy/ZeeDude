"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AdminError,
  assertEditable,
  createPeriod,
  deleteEntry,
  deletePeriod,
  finalizePeriod,
  reopenPeriod,
  saveEntry,
  setPayoutPaid,
  snapshotPeriod,
  updatePeriod,
} from "@/lib/admin-ops";
import { login, logout, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseAffiliatePaste } from "@/lib/affiliate";
import {
  deleteAffiliateSnapshot,
  type PeriodOutcome,
  previewAffiliateSnapshot,
  saveAffiliateSnapshot,
} from "@/lib/affiliate-import";
import { saveEntries } from "@/lib/entries";
import { LEADERBOARD_TAG } from "@/lib/leaderboard";
import { isValidSplit } from "@/lib/payouts";
import { fromZonedInputValue } from "@/lib/period";
import { CsvImportProvider, ProviderError } from "@/lib/providers";
import { ProfileError, reviewClaim } from "@/lib/profile";
import { reviewedClaimKeySchema } from "@/lib/profile-schema";
import { normalizeUsername } from "@/lib/ranking";
import { ensureCurrentPeriod, runRefresh } from "@/lib/refresh";
import { BusyError } from "@/lib/tx";

export type ActionResult = { ok: boolean; message: string; details?: string[] } | null;

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Refreshes the public leaderboard and the admin pages after a change. */
function changed() {
  updateTag(LEADERBOARD_TAG);
  revalidatePath("/admin", "layout");
}

/** Wraps an action: checks the admin session and turns expected errors into messages. */
async function guarded<R extends ActionResult>(run: () => Promise<R>): Promise<R | ActionResult> {
  await requireAdmin();
  try {
    return await run();
  } catch (error) {
    if (error instanceof AdminError || error instanceof BusyError || error instanceof ProfileError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, message: "Please fix these values:", details: error.issues.map((i) => i.message) };
    }
    throw error;
  }
}

const id = z.string().min(1).max(64);
const solAmount = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a number`)
    .nonnegative(`${label} can't be negative`)
    .max(1e9, `${label} is too large`);
const optionalAmount = (label: string) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), solAmount(label).optional());
const username = z
  .string()
  .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
  .pipe(z.string().min(1, "Username is required").max(64, "Username is too long"));

// ---------------------------------------------------------------- session

export async function loginAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const password = z.string().min(1).max(200).safeParse(form.get("password"));
  if (!password.success) return { ok: false, message: "Enter the admin password." };
  const result = await login(password.data);
  if (!result.ok) return { ok: false, message: result.error };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- periods

const periodSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
    startsAt: z.string().transform((v, ctx) => {
      const d = fromZonedInputValue(v);
      if (!d) ctx.addIssue({ code: "custom", message: "Start time is invalid" });
      return d ?? new Date(0);
    }),
    endsAt: z.string().transform((v, ctx) => {
      const d = fromZonedInputValue(v);
      if (!d) ctx.addIssue({ code: "custom", message: "End time is invalid" });
      return d ?? new Date(0);
    }),
    prizePoolSol: solAmount("Prize pool"),
    payoutSplit: z.string().transform((v, ctx) => {
      const split = v
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((p) => Number(p.replace("%", "")));
      if (split.length > 100) ctx.addIssue({ code: "custom", message: "At most 100 paid places" });
      if (!isValidSplit(split)) {
        const total = split.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
        ctx.addIssue({ code: "custom", message: `Payout split must be positive numbers adding up to 100 (currently ${+total.toFixed(4)})` });
      }
      return split;
    }),
  })
  .refine((p) => p.endsAt > p.startsAt, { message: "End time must be after the start time" });

function readPeriodForm(form: FormData) {
  return periodSchema.parse({
    name: form.get("name"),
    startsAt: form.get("startsAt"),
    endsAt: form.get("endsAt"),
    prizePoolSol: form.get("prizePoolSol"),
    payoutSplit: form.get("payoutSplit"),
  });
}

export async function createPeriodAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  let createdId = "";
  const result = await guarded(async () => {
    const period = await createPeriod(readPeriodForm(form));
    createdId = period.id;
    changed();
    return { ok: true, message: "Period created." };
  });
  if (createdId) redirect(`/admin/periods/${createdId}`);
  return result;
}

export async function updatePeriodAction(periodId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await updatePeriod(id.parse(periodId), readPeriodForm(form));
    changed();
    return { ok: true, message: "Saved." };
  });
}

export async function finalizePeriodAction(periodId: string, _prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    const { winners } = await finalizePeriod(id.parse(periodId));
    changed();
    return { ok: true, message: `Period ended. ${winners} winners locked in. Mark them paid below once sent.` };
  });
}

export async function reopenPeriodAction(periodId: string, _prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    await reopenPeriod(id.parse(periodId));
    changed();
    return { ok: true, message: "Period reopened. Payouts were cleared; end it again when ready." };
  });
}

export async function deletePeriodAction(periodId: string, _prev: ActionResult): Promise<ActionResult> {
  const result = await guarded(async () => {
    await deletePeriod(id.parse(periodId));
    changed();
    return { ok: true, message: "Deleted." };
  });
  if (result?.ok) redirect("/admin/periods");
  return result;
}

// ---------------------------------------------------------------- wager data

export async function importEntriesAction(periodId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    // Early exit before parsing; saveEntries re-checks inside its transaction.
    await assertEditable(id.parse(periodId));
    const mode = z.enum(["replace", "merge"]).parse(form.get("mode"));
    const file = form.get("file");
    const pasted = z.string().max(MAX_UPLOAD_BYTES).optional().parse(form.get("pasted") ?? undefined);

    let text: string;
    let format: "csv" | "json";
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) throw new AdminError("File is larger than 2 MB.");
      text = await file.text();
      format = file.name.toLowerCase().endsWith(".json") || file.type === "application/json" ? "json" : "csv";
    } else if (pasted?.trim()) {
      text = pasted;
      format = /^\s*[[{]/.test(pasted) ? "json" : "csv";
    } else {
      throw new AdminError("Choose a file or paste data to import.");
    }

    const provider = new CsvImportProvider(text, format);
    let entries;
    try {
      entries = await provider.fetchEntries();
    } catch (error) {
      if (error instanceof ProviderError) return { ok: false, message: error.message, details: error.details };
      throw error;
    }

    await saveEntries(periodId, entries, mode, format);
    await snapshotPeriod(periodId);
    changed();

    const notes = [
      provider.stats.duplicatesMerged ? `${provider.stats.duplicatesMerged} duplicate rows were added together` : "",
      provider.stats.skippedBlank ? `${provider.stats.skippedBlank} blank rows skipped` : "",
    ].filter(Boolean);
    return {
      ok: true,
      message: `Imported ${entries.length} players (${mode === "replace" ? "replaced all existing rows" : "merged with existing rows"}).`,
      details: notes,
    };
  });
}

export async function saveEntryAction(periodId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const data = z
      .object({ username, wageredSol: solAmount("Wagered SOL"), wageredUsd: optionalAmount("Wagered USD") })
      .parse({ username: form.get("username"), wageredSol: form.get("wageredSol"), wageredUsd: form.get("wageredUsd") });
    const { updated } = await saveEntry(id.parse(periodId), data);
    changed();
    return { ok: true, message: updated ? `Updated ${updated}.` : `Added ${data.username}.` };
  });
}

export async function deleteEntryAction(entryId: string, _prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    const removed = await deleteEntry(id.parse(entryId));
    changed();
    return { ok: true, message: `Removed ${removed}.` };
  });
}

// ---------------------------------------------------------------- payouts

export async function setPayoutPaidAction(payoutId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const data = z
      .object({ paid: z.enum(["true", "false"]), txNote: z.string().trim().max(500, "Note is too long") })
      .parse({ paid: form.get("paid"), txNote: form.get("txNote") ?? "" });
    const paid = data.paid === "true";
    const payout = await setPayoutPaid(id.parse(payoutId), paid, data.txNote || null);
    changed();
    return { ok: true, message: paid ? `Marked ${payout.username} as paid.` : `Marked ${payout.username} as unpaid.` };
  });
}

// ---------------------------------------------------------------- exclusions

export async function excludeUserAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const data = z
      .object({ username, reason: z.string().trim().min(1, "Give a reason").max(200, "Reason is too long") })
      .parse({ username: form.get("username"), reason: form.get("reason") });
    const key = normalizeUsername(data.username);
    await db.excludedUser.upsert({
      where: { username: key },
      create: { username: key, reason: data.reason },
      update: { reason: data.reason },
    });
    changed();
    return { ok: true, message: `${data.username} is excluded from all leaderboards.` };
  });
}

export async function unexcludeUserAction(excludedId: string, _prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    const user = await db.excludedUser.delete({ where: { id: id.parse(excludedId) } });
    changed();
    return { ok: true, message: `${user.username} can place again.` };
  });
}

// ---------------------------------------------------------------- settings

export async function setMaskingAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const mask = z.enum(["true", "false"]).parse(form.get("mask"));
    await db.setting.upsert({ where: { key: "maskUsernames" }, create: { key: "maskUsernames", value: mask }, update: { value: mask } });
    changed();
    return { ok: true, message: mask === "true" ? "Usernames are now masked." : "Full usernames are now public." };
  });
}

export async function refreshAction(_prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    const report = await runRefresh();
    changed();
    const details = [
      report.createdPeriod ? `Created this week’s period: ${report.createdPeriod}` : "",
      ...report.refreshed.map((r) => `${r.period}: ${r.players} players fetched`),
      ...report.errors,
    ].filter(Boolean);
    return report.ok
      ? { ok: true, message: "Leaderboard refreshed. The public site now shows the latest data.", details }
      : { ok: false, message: "Refresh ran, but the data source failed. The site keeps showing the last saved data.", details };
  });
}

// ---------------------------------------------------------------- player profiles

export async function reviewClaimAction(
  playerId: string,
  decision: "approve" | "reject" | "reset",
  reviewedKey: string,
  _prev: ActionResult,
): Promise<ActionResult> {
  return guarded(async () => {
    const player = await reviewClaim(
      id.parse(playerId),
      z.enum(["approve", "reject", "reset"]).parse(decision),
      reviewedClaimKeySchema.parse(reviewedKey),
    );
    changed();
    const label = { approve: "verified", reject: "rejected", reset: "moved back to pending" }[decision];
    return { ok: true, message: `${player.solpumpUsername ?? "Claim"} ${label}.` };
  });
}

// ---------------------------------------------------------------- SolPump affiliate list

export type AffiliatePeriodPreview = {
  periodName: string;
  baselineAt: string | null;
  latestAt: string | null;
  players: number;
  totalSol: number;
  top: { username: string; wageredSol: number; lifetimeSol: number }[];
  warnings: string[];
};
export type AffiliateResult = (NonNullable<ActionResult> & { periods?: AffiliatePeriodPreview[] }) | null;

function describeOutcomes(outcomes: PeriodOutcome[]): AffiliatePeriodPreview[] {
  return outcomes.map((o) => ({
    periodName: o.periodName,
    baselineAt: o.baselineAt?.toISOString() ?? null,
    latestAt: o.latestAt?.toISOString() ?? null,
    players: o.rows.length,
    totalSol: o.rows.reduce((sum, r) => sum + r.wageredSol, 0),
    top: o.rows.slice(0, 15),
    warnings: o.warnings,
  }));
}

/** Preview or save a paste of SolPump's affiliate list (all-time totals). */
export async function affiliateImportAction(_prev: AffiliateResult, form: FormData): Promise<AffiliateResult> {
  return guarded(async (): Promise<AffiliateResult> => {
    const intent = z.enum(["preview", "save"]).parse(form.get("intent"));
    const text = z.string().max(MAX_UPLOAD_BYTES, "The paste is larger than 2 MB.").parse(form.get("paste") ?? "");
    const takenAtRaw = z.string().max(32).parse(form.get("takenAt") ?? "");
    const takenAt = takenAtRaw ? fromZonedInputValue(takenAtRaw) : new Date();
    if (!takenAt) throw new AdminError("The copy time isn't a valid date.");

    const parsed = parseAffiliatePaste(text);
    if (parsed.errors.length) return { ok: false, message: "Couldn't read the paste:", details: parsed.errors.slice(0, 10) };

    // Make sure this week's period exists so the paste has somewhere to go.
    await ensureCurrentPeriod();
    if (intent === "preview") {
      const outcomes = await previewAffiliateSnapshot(parsed.rows, takenAt);
      return {
        ok: true,
        message: `Read ${parsed.rows.length} players. Nothing is saved yet.`,
        details: parsed.warnings,
        periods: describeOutcomes(outcomes),
      };
    }

    const outcomes = await saveAffiliateSnapshot(parsed.rows, takenAt);
    for (const o of outcomes) if (o.baselineAt) await snapshotPeriod(o.periodId);
    changed();
    return {
      ok: true,
      message: `Saved a copy of ${parsed.rows.length} players.`,
      details: [
        ...parsed.warnings,
        ...outcomes.map((o) =>
          o.baselineAt
            ? `${o.periodName}: leaderboard updated (${o.rows.length} players).`
            : `${o.periodName}: saved as the starting point; totals appear after the next copy.`,
        ),
      ],
      periods: describeOutcomes(outcomes),
    };
  });
}

export async function deleteAffiliateSnapshotAction(snapshotId: string, _prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    const outcomes = await deleteAffiliateSnapshot(id.parse(snapshotId));
    for (const o of outcomes) if (o.baselineAt) await snapshotPeriod(o.periodId);
    changed();
    return {
      ok: true,
      message: "Copy deleted.",
      details: outcomes.map((o) =>
        o.baselineAt ? `${o.periodName}: leaderboard recalculated.` : `${o.periodName}: ${o.warnings.join(" ") || "No earlier copy left to compare with, so its leaderboard was left as it was."}`,
      ),
    };
  });
}
