"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LEADERBOARD_TAG } from "@/lib/leaderboard";
import { currentPlayerWallet, finishWalletSignIn, PlayerAuthError, signOutPlayer, startWalletSignIn } from "@/lib/player-auth";
import { ProfileError, profileSchema, saveProfile } from "@/lib/profile";
import { BusyError } from "@/lib/tx";

export type SignInStep = { ok: true; nonce: string; message: string } | { ok: false; error: string };
export type ProfileResult = { ok: boolean; message: string; details?: string[] } | null;

const walletSchema = z.string().trim().min(32).max(44);

export async function startSignInAction(wallet: string): Promise<SignInStep> {
  const parsed = walletSchema.safeParse(wallet);
  if (!parsed.success) return { ok: false, error: "That doesn't look like a Solana wallet address." };
  try {
    return { ok: true, ...(await startWalletSignIn(parsed.data)) };
  } catch (error) {
    if (error instanceof PlayerAuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function finishSignInAction(wallet: string, nonce: string, signature: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = z
    .object({ wallet: walletSchema, nonce: z.string().regex(/^[0-9a-f]{32}$/), signature: z.string().max(200) })
    .safeParse({ wallet, nonce, signature });
  if (!parsed.success) return { ok: false, error: "Sign-in failed. Please try again." };
  try {
    await finishWalletSignIn(parsed.data.wallet, parsed.data.nonce, parsed.data.signature);
    revalidatePath("/profile");
    return { ok: true };
  } catch (error) {
    if (error instanceof PlayerAuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function signOutAction() {
  await signOutPlayer();
  redirect("/profile");
}

export async function saveProfileAction(_prev: ProfileResult, form: FormData): Promise<ProfileResult> {
  const wallet = await currentPlayerWallet();
  if (!wallet) return { ok: false, message: "Your session expired. Please sign in again." };

  const parsed = profileSchema.safeParse({
    solpumpUsername: form.get("solpumpUsername") ?? "",
    displayName: form.get("displayName") ?? "",
    discordUsername: form.get("discordUsername") ?? "",
    kickUsername: form.get("kickUsername") ?? "",
    xUsername: form.get("xUsername") ?? "",
    hideName: form.get("hideName") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: "Please fix these:", details: parsed.error.issues.map((i) => i.message) };
  }

  try {
    const { claimChanged, status, boardChanged } = await saveProfile(wallet, parsed.data);
    // An approved claim's name or visibility changes how the public board
    // shows names. Other saves leave the cached board alone, so repeated
    // saves can't keep forcing it to be rebuilt.
    if (boardChanged) updateTag(LEADERBOARD_TAG);
    revalidatePath("/profile");
    return {
      ok: true,
      message:
        claimChanged && status === "pending"
          ? "Saved! Your SolPump username is waiting for an admin to verify it."
          : "Profile saved.",
    };
  } catch (error) {
    if (error instanceof ProfileError || error instanceof BusyError) return { ok: false, message: error.message };
    throw error;
  }
}
