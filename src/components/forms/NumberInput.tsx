// Numeric input. Sets `inputMode="decimal"` by default so the iOS / Android
// keyboard pops the number pad. Use `inputMode="numeric"` if the value is an
// integer (saves the decimal key on the keyboard).

import type { InputHTMLAttributes } from "react";

import { FIELD_CONTROL_CLASS } from "./fieldStyles";

export function NumberInput({
  className = "",
  inputMode = "decimal",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      className={`${FIELD_CONTROL_CLASS} ${className}`}
      {...props}
    />
  );
}
