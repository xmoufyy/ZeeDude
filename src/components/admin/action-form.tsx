"use client";

import { useEffect, useRef } from "react";
import type { ActionResult } from "@/app/admin/actions";
import { useFormAction } from "@/components/use-form-action";

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
  const { state, dispatch, pending, submit } = useFormAction(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const buttonClass = variant === "primary" ? "btn btn-primary" : variant === "danger" ? "btn btn-danger" : "btn";

  // Clear the fields only after a success; after an error the admin's input stays put.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={dispatch}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        else submit(e);
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
        <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${state.ok ? "border-success/30 bg-success/10 text-success" : "border-danger/35 bg-danger/10 text-danger"}`}>
          <p>
            <span aria-hidden="true">{state.ok ? "✓ " : "✕ "}</span>
            {state.message}
          </p>
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
