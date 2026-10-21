"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { ResultMessage } from "@/components/admin/action-form";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="input" />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Checking..." : "Log in"}
      </button>
      <ResultMessage state={state} />
    </form>
  );
}
