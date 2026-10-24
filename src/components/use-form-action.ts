"use client";

import { type FormEvent, startTransition, useActionState } from "react";

/**
 * useActionState for a form, minus React's automatic reset. React clears a
 * form's fields after every action it runs, so an error message (or a
 * preview) would wipe what the user typed. Call `submit` from onSubmit to run
 * the action without that reset, and reset the form yourself on success.
 * Keep `action={dispatch}` on the form so it still works before hydration.
 */
export function useFormAction<State>(action: (state: Awaited<State>, form: FormData) => State | Promise<State>, initial: Awaited<State>) {
  const [state, dispatch, pending] = useActionState(action, initial);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Include the clicked button's name/value, like a normal submission does.
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(data));
  }

  return { state, dispatch, pending, submit };
}
