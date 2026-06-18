// Wraps the native <input type="datetime-local">. Browsers - including iOS
// Safari and Chrome on Android - render this as a native picker that beats
// any JS date library on mobile.
//
// The value format is "YYYY-MM-DDTHH:mm" (local time, no timezone). On the
// server you turn that into a Date by `new Date(value)` which interprets it
// as local time; the DB stores timestamptz which UTC-normalizes it.

import type { InputHTMLAttributes } from "react";

import { FIELD_CONTROL_CLASS } from "./fieldStyles";

export function DateTimePicker({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="datetime-local"
      className={`${FIELD_CONTROL_CLASS} ${className}`}
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
