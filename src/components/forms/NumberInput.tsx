// Numeric input. Sets `inputMode="decimal"` by default so the iOS / Android
// keyboard pops the number pad. Use `inputMode="numeric"` if the value is an
// integer (saves the decimal key on the keyboard).

import type { InputHTMLAttributes } from "react";

export function NumberInput({
  className = "",
  inputMode = "decimal",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      className={`min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-50 dark:focus:ring-zinc-50 ${className}`}
      {...props}
    />
  );
}
