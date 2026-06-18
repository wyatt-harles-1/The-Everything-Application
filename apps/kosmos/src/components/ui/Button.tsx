// Token-styled button with variants. Server-safe (no hooks) — for form submits
// that need pending state, use forms/SubmitButton instead. `buttonClasses` is
// exported so a <Link> can be styled as a button without wrapping it.

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg shadow-soft hover:opacity-90",
  secondary: "border border-border bg-surface text-text hover:bg-hover",
  ghost: "text-muted hover:bg-hover hover:text-text",
  danger: "bg-danger text-danger-fg hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "min-h-[var(--control-h)] px-4 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-card)] font-semibold transition-all disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
