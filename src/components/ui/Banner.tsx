// Inline status banner — form errors, success flashes, warnings. Tone maps to
// the semantic status tokens so it themes automatically.

import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type BannerTone = "info" | "success" | "warn" | "danger";

const TONES: Record<BannerTone, string> = {
  info: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};

export function Banner({
  tone = "info",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: BannerTone }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--radius-card)] px-3 py-2 text-sm",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
