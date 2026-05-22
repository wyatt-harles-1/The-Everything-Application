// Wraps the native <input type="datetime-local">. Browsers - including iOS
// Safari and Chrome on Android - render this as a native picker that beats
// any JS date library on mobile.
//
// The value format is "YYYY-MM-DDTHH:mm" (local time, no timezone). On the
// server you turn that into a Date by `new Date(value)` which interprets it
// as local time; the DB stores timestamptz which UTC-normalizes it.

import type { InputHTMLAttributes } from "react";

export function DateTimePicker({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="datetime-local"
      className={`min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50 ${className}`}
      {...props}
    />
  );
}

// Helper for forms that want to default to "now". Returns the current local
// time formatted as the datetime-local string the input expects.
export function nowDateTimeLocal(): string {
  const d = new Date();
  // YYYY-MM-DDTHH:mm in local time. toISOString() returns UTC; we don't want
  // that. Build it from local fields.
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
