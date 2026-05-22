// Native <input type="date"> for calendar-only fields (no time). Same look
// + sizing as DateTimePicker. Use this when the underlying column is a SQL
// DATE (cycle_entries.occurred_at, medications.started_on, etc.) so the form
// posts "YYYY-MM-DD" instead of "YYYY-MM-DDTHH:mm".

import type { InputHTMLAttributes } from "react";

export function DatePicker({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="date"
      className={`min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50 ${className}`}
      {...props}
    />
  );
}

// Helper: format a Date (or ISO timestamp) as "YYYY-MM-DD" using UTC fields
// so SSR matches client-side render.
export function toDateInputValue(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
