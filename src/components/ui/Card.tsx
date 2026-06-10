// The base surface for content: soft-shadowed, large-radius, token-themed.
// Density controls the padding via --space-card. Pass `interactive` for the
// subtle hover used by tappable/linked cards.

import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface p-[var(--space-card)] shadow-soft",
        interactive && "transition-colors hover:bg-hover",
        className,
      )}
      {...props}
    />
  );
}
