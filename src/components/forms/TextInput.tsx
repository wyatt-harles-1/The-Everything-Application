// Pre-styled text input. 44px min-height for phone tap targets.
// Server-Component-safe.

import type { InputHTMLAttributes } from "react";

import { FIELD_CONTROL_CLASS } from "./fieldStyles";

export function TextInput({
  className = "",
  type = "text",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={`${FIELD_CONTROL_CLASS} ${className}`}
      {...props}
    />
  );
}
