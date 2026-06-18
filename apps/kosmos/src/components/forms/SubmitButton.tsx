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
      className={`min-h-[var(--control-h)] w-full rounded-[var(--radius-card)] bg-accent px-4 py-2 text-sm font-semibold text-accent-fg shadow-soft transition-opacity hover:opacity-90 disabled:opacity-60 ${className}`}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
