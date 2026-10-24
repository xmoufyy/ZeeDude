import { z } from "zod";

// Validation for the My Profile form. Kept separate from profile.ts (which is
// server-only) so it can be unit tested.

const stripControl = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim();
const optional = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());
const handle = (v: unknown) => (typeof v === "string" ? stripControl(v).replace(/^@/, "") : v);

export const profileSchema = z.object({
  solpumpUsername: optional(z.string().transform(stripControl).pipe(z.string().min(1).max(64, "SolPump username is too long"))),
  displayName: optional(z.string().transform(stripControl).pipe(z.string().max(40, "Display name is too long (40 max)"))),
  discordUsername: optional(
    z.preprocess(
      (v) => (typeof handle(v) === "string" ? (handle(v) as string).toLowerCase() : v),
      z.string().regex(/^[a-z0-9_.]{2,32}$/, "Discord usernames are 2-32 characters: letters, numbers, _ and ."),
    ),
  ),
  kickUsername: optional(z.preprocess(handle, z.string().regex(/^[A-Za-z0-9_]{3,25}$/, "Kick usernames are 3-25 characters: letters, numbers and _"))),
  xUsername: optional(z.preprocess(handle, z.string().regex(/^[A-Za-z0-9_]{1,15}$/, "X handles are up to 15 characters: letters, numbers and _"))),
  hideName: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// Unicode lowercasing can expand each U+0130 into two UTF-16 units.
// Keep every accepted 64-unit username reviewable without changing its key.
export const reviewedClaimKeySchema = z.string().min(1).max(128);

