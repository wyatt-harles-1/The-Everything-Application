// The square nav/quick-action tile used by the Quick log + Sections widgets.

import Link from "next/link";

export function HomeTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-center rounded-[var(--radius-card)] border border-border bg-surface px-3 py-3 text-sm font-medium text-text shadow-soft transition-colors hover:bg-hover"
    >
      {label}
    </Link>
  );
}
