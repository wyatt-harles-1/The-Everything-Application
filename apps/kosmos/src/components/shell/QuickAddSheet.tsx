// The center "+Add" sheet on mobile: jump straight into the most-logged forms.
// Mirrors the home "Quick log" grid so adding an entry is always one tap away.

"use client";

import Link from "next/link";
import { Dumbbell, UtensilsCrossed, Moon, Smile, type LucideIcon } from "lucide-react";

import { Sheet } from "@/components/ui/Sheet";

const QUICK_ADD: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/log/workout/new", label: "Workout", icon: Dumbbell },
  { href: "/log/meal/new", label: "Meal", icon: UtensilsCrossed },
  { href: "/log/sleep/new", label: "Sleep", icon: Moon },
  { href: "/log/mood/new", label: "Mood", icon: Smile },
];

export function QuickAddSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Quick add">
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ADD.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 text-sm font-medium text-text transition-colors hover:bg-hover"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon size={18} strokeWidth={2} aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </Sheet>
  );
}
