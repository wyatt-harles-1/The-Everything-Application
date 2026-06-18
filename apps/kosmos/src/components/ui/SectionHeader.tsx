// The "Title ............ all →" row that sits above most dashboard sections.
// Replaces the repeated h2 + optional link markup so spacing/typography stay
// consistent everywhere.

import Link from "next/link";

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold text-text">{title}</h2>
      {action ? (
        <Link
          href={action.href}
          className="shrink-0 text-xs font-medium text-accent hover:opacity-80"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
