// Bottom sheet — slides up from the bottom edge with a dimmed, blurred
// backdrop. Used for the mobile More menu, Quick-add, and the home edit panel.
// Closes on backdrop click or Esc; locks body scroll while open. Token-styled
// so it follows the active theme.

"use client";

import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-sm"
      />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[var(--radius-lg)] border-t border-border bg-surface-raised p-4 shadow-pop",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          className,
        )}
      >
        {/* grab handle */}
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
        {title ? (
          <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
