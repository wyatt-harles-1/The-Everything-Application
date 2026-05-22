// Field wrapper: label on top, input(s) as children, optional error message
// underneath. Every form field in the app uses this for consistent vertical
// rhythm and accessible label-input pairing.
//
// Pure presentation - no client behavior, so it's Server-Component-safe.

import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center justify-between text-sm font-medium"
      >
        <span>
          {label}
          {required ? (
            <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden>
              *
            </span>
          ) : null}
        </span>
        {hint ? (
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {hint}
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
