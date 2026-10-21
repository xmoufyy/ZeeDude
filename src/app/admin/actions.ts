"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminError, assertEditable, finalizePeriod, findOverlappingPeriod, reopenPeriod, snapshotPeriod } from "@/lib/admin-ops";
import { login, logout, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveEntries } from "@/lib/entries";
import { LEADERBOARD_TAG } from "@/lib/leaderboard";
import { isValidSplit } from "@/lib/payouts";
import { fromZonedInputValue } from "@/lib/period";
import { CsvImportProvider, ProviderError } from "@/lib/providers";
import { normalizeUsername } from "@/lib/ranking";
import { runRefresh } from "@/lib/refresh";

export type ActionResult = { ok: boolean; message: string; details?: string[] } | null;

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Refreshes the public leaderboard and the admin pages after a change. */
function changed() {
  updateTag(LEADERBOARD_TAG);
  revalidatePath("/admin", "layout");
}

/** Wraps an action: checks the admin session and turns expected errors into messages. */
async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  await requireAdmin();
  try {
    return await run();
  } catch (error) {
    if (error instanceof AdminError) return { ok: false, message: error.message };
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
    const data = readPeriodForm(form);
    const overlap = await findOverlappingPeriod(data.startsAt, data.endsAt);
    if (overlap) throw new AdminError(`Those dates overlap "${overlap.name}".`);
    const period = await db.period.create({ data: { ...data, payoutSplit: JSON.stringify(data.payoutSplit) } });
    createdId = period.id;
    changed();
    return { ok: true, message: "Period created." };
  });
  if (createdId) redirect(`/admin/periods/${createdId}`);
  return result;
}

export async function updatePeriodAction(periodId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    await assertEditable(id.parse(periodId));
    const data = readPeriodForm(form);
    const overlap = await findOverlappingPeriod(data.startsAt, data.endsAt, periodId);
    if (overlap) throw new AdminError(`Those dates overlap "${overlap.name}".`);
    await db.period.update({ where: { id: periodId }, data: { ...data, payoutSplit: JSON.stringify(data.payoutSplit) } });
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
    const paid = await db.payout.count({ where: { periodId: id.parse(periodId), paid: true } });
    if (paid > 0) throw new AdminError("Can't delete a period with paid prizes. It's part of the payout record.");
    await db.period.delete({ where: { id: periodId } });
    changed();
    return { ok: true, message: "Deleted." };
  });
  if (result?.ok) redirect("/admin/periods");
  return result;
}

// ---------------------------------------------------------------- wager data

export async function importEntriesAction(periodId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
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
    await assertEditable(id.parse(periodId));
    const data = z
      .object({ username, wageredSol: solAmount("Wagered SOL"), wageredUsd: optionalAmount("Wagered USD") })
      .parse({ username: form.get("username"), wageredSol: form.get("wageredSol"), wageredUsd: form.get("wageredUsd") });

    const entries = await db.wagerEntry.findMany({ where: { periodId }, select: { id: true, username: true } });
    const match = entries.find((e) => normalizeUsername(e.username) === normalizeUsername(data.username));
    const values = { wageredSol: data.wageredSol, wageredUsd: data.wageredUsd ?? null, source: "manual" };

    await db.$transaction([
      match
        ? db.wagerEntry.update({ where: { id: match.id }, data: values })
        : db.wagerEntry.create({ data: { ...values, periodId, username: data.username } }),
      db.period.update({ where: { id: periodId }, data: { dataUpdatedAt: new Date() } }),
    ]);
    changed();
    return { ok: true, message: match ? `Updated ${match.username}.` : `Added ${data.username}.` };
  });
}

export async function deleteEntryAction(entryId: string, _prev: ActionResult): Promise<ActionResult> {
  return guarded(async () => {
    const entry = await db.wagerEntry.findUnique({ where: { id: id.parse(entryId) } });
    if (!entry) throw new AdminError("Row not found.");
    await assertEditable(entry.periodId);
    await db.$transaction([
      db.wagerEntry.delete({ where: { id: entry.id } }),
      db.period.update({ where: { id: entry.periodId }, data: { dataUpdatedAt: new Date() } }),
    ]);
    changed();
    return { ok: true, message: `Removed ${entry.username}.` };
  });
}

// ---------------------------------------------------------------- payouts

export async function setPayoutPaidAction(payoutId: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  return guarded(async () => {
    const data = z
      .object({ paid: z.enum(["true", "false"]), txNote: z.string().trim().max(500, "Note is too long") })
      .parse({ paid: form.get("paid"), txNote: form.get("txNote") ?? "" });
    const paid = data.paid === "true";
    const payout = await db.payout.update({
      where: { id: id.parse(payoutId) },
      data: { paid, paidAt: paid ? new Date() : null, txNote: data.txNote || null },
    });
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
