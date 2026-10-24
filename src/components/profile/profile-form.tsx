"use client";

import { useEffect, useRef, useState } from "react";
import { saveProfileAction, type ProfileResult } from "@/app/profile/actions";
import { useFormAction } from "@/components/use-form-action";

type Props = {
  wallet: string;
  values: {
    solpumpUsername: string;
    displayName: string;
    discordUsername: string;
    kickUsername: string;
    xUsername: string;
    hideName: boolean;
  };
  claimStatus: "none" | "pending" | "approved" | "rejected";
};

const STATUS = {
  none: null,
  pending: { label: "Pending verification", className: "bg-gold/15 text-gold" },
  approved: { label: "Verified", className: "bg-emerald-400/15 text-emerald-300" },
  rejected: { label: "Not verified", className: "bg-red-400/15 text-red-300" },
} as const;

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="text-magenta"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ wallet, values, claimStatus }: Props) {
  const { state, dispatch, pending, submit } = useFormAction<ProfileResult>(saveProfileAction, null);
  const [hideName, setHideName] = useState(values.hideName);
  const formRef = useRef<HTMLFormElement>(null);
  const toggleRef = useRef<HTMLInputElement>(null);
  const status = STATUS[claimStatus];
  const input = "input py-2.5 text-base";

  // After a save, show the stored values (e.g. "@Name" saved as "name"); after
  // an error, keep what the player typed so they can fix it.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={dispatch}
      onSubmit={submit}
      // The reset event fires before fields are restored, so read the switch afterwards.
      onReset={() => setTimeout(() => setHideName(toggleRef.current?.checked ?? values.hideName))}
      className="space-y-5"
    >
      <p className="rounded-xl border border-magenta/40 bg-magenta/10 px-4 py-3 text-sm">
        <strong>One profile per person.</strong> Duplicate wallets, Discords or usernames, or obvious alt accounts, can be
        removed from rewards.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="solpumpUsername"
          label="SolPump username"
          required
          hint={
            <>
              Exactly as it appears on SolPump.{" "}
              {status && <span className={`ml-1 rounded-full px-2 py-0.5 font-semibold ${status.className}`}>{status.label}</span>}
              {claimStatus === "pending" && " An admin checks it against our SolPump referrals."}
              {claimStatus === "rejected" && " We couldn't match it to a ZEEDUDE referral. Check the spelling or ask on Discord."}
            </>
          }
        >
          <input id="solpumpUsername" name="solpumpUsername" defaultValue={values.solpumpUsername} required maxLength={64} className={input} />
        </Field>
        <Field id="displayName" label="Display name" hint="Shown on your profile only.">
          <input id="displayName" name="displayName" defaultValue={values.displayName} maxLength={40} className={input} />
        </Field>
      </div>

      <Field id="wallet" label="Payout wallet" hint="Verified: you signed in with this wallet. Prizes are sent here.">
        <input id="wallet" value={wallet} readOnly className={`${input} font-mono text-sm text-muted`} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="discordUsername" label="Discord username">
          <input id="discordUsername" name="discordUsername" defaultValue={values.discordUsername} maxLength={33} placeholder="yourname" className={input} />
        </Field>
        <Field id="kickUsername" label="Kick username">
          <input id="kickUsername" name="kickUsername" defaultValue={values.kickUsername} maxLength={26} className={input} />
        </Field>
      </div>
      <Field id="xUsername" label="X username">
        <input id="xUsername" name="xUsername" defaultValue={values.xUsername} maxLength={16} placeholder="@handle" className={input} />
      </Field>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-ink/40 p-4">
        <div>
          <p id="hide-label" className="font-semibold">
            Hide my name on the leaderboard
          </p>
          <p id="hide-desc" className="mt-1 text-sm text-muted">
            {hideName ? "Shown masked, like Ze****an." : "Your full SolPump username is shown."}{" "}
            {claimStatus !== "approved" && "Takes effect once your username is verified."}
          </p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          {/* Uncontrolled: the form is reset after a successful save, and a
              reset must restore the saved value (defaultChecked), not the first render's. */}
          <input
            ref={toggleRef}
            type="checkbox"
            name="hideName"
            role="switch"
            aria-labelledby="hide-label"
            aria-describedby="hide-desc"
            defaultChecked={values.hideName}
            onChange={(e) => setHideName(e.target.checked)}
            className="peer sr-only"
          />
          <span className="h-7 w-12 rounded-full bg-white/15 transition peer-checked:bg-gold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold" />
          <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-3 text-base">
        {pending ? "Saving…" : "Save profile"}
      </button>
      <div aria-live="polite">
        {state && (
          <div className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
            <p>{state.message}</p>
            {state.details && (
              <ul className="mt-1 list-disc pl-5 text-xs">
                {state.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
