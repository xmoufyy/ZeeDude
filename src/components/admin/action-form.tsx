"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/admin/actions";

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

type Props = {
  action: Action;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Asks the browser to confirm before submitting. */
  confirm?: string;
  variant?: "primary" | "danger" | "plain";
  className?: string;
  /** Lay the button out next to the fields instead of below them. */
  inline?: boolean;
};

/** A form wired to a Server Action that shows the action's result message. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving...",
  confirm,
  variant = "primary",
  className = "",
  inline = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const buttonClass = variant === "primary" ? "btn btn-primary" : variant === "danger" ? "btn btn-danger" : "btn";

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={className}
    >
      <div className={inline ? "flex flex-wrap items-end gap-2" : "space-y-4"}>
        {children}
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
      <ResultMessage state={state} />
    </form>
  );
}

export function ResultMessage({ state }: { state: ActionResult }) {
  return (
    <div aria-live="polite">
      {state && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
          <p>{state.message}</p>
          {state.details && state.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs opacity-90">
              {state.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
