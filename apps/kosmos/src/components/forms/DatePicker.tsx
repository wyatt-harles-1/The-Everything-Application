// Native <input type="date"> for calendar-only fields (no time). Same look
// + sizing as DateTimePicker. Use this when the underlying column is a SQL
// DATE (cycle_entries.occurred_at, medications.started_on, etc.) so the form
// posts "YYYY-MM-DD" instead of "YYYY-MM-DDTHH:mm".

import type { InputHTMLAttributes } from "react";

import { FIELD_CONTROL_CLASS } from "./fieldStyles";

export function DatePicker({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="date"
      className={`${FIELD_CONTROL_CLASS} ${className}`}
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
