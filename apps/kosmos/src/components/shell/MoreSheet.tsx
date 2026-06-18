// The mobile "More" sheet: every destination not on the bottom bar, as a grid
// of tappable tiles, plus the signed-in email and a sign-out form.

"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { Sheet } from "@/components/ui/Sheet";

import { MORE_ITEMS } from "./nav-items";

export function MoreSheet({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="More">
      <div className="grid grid-cols-3 gap-2">
        {MORE_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-border bg-surface p-3 text-center text-xs font-medium text-text transition-colors hover:bg-hover"
          >
            <Icon size={20} strokeWidth={2} className="text-muted" aria-hidden />
            {label}
          </Link>
        ))}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="truncate px-1 pb-1 text-xs text-muted">{email}</p>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-[var(--radius-card)] px-1 py-2 text-sm font-medium text-danger transition-colors hover:bg-hover"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </Sheet>
  );
}
