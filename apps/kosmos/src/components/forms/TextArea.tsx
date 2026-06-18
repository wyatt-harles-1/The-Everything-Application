// Multi-line text input. Default 3 rows; pages can override via the `rows`
// prop. Same look + sizing as TextInput.

import type { TextareaHTMLAttributes } from "react";

import { FIELD_CLASS } from "./fieldStyles";

export function TextArea({
  className = "",
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={`${FIELD_CLASS} ${className}`}
      {...props}
    />
  );
}
