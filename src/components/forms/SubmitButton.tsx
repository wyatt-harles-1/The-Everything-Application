// Submit button that knows when the surrounding form is mid-submit. Disables
// itself + swaps label so the user can't double-submit while the Server
// Action is running. Has to be a Client Component because `useFormStatus`
// reads from React's <form> context.

"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`min-h-11 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 ${className}`}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
