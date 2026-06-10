// A compact month-grid day cell: the day number plus up to three item dots.
// Used by the home CalendarWidget and the full /calendar month view.
// Presentational (no client hooks) so it renders in either tree.

import Link from "next/link";

import { cn } from "@/lib/cn";

import { EventDot } from "./EventDot";
import type { CalendarItem } from "@/lib/calendar/types";

export function DayCell({
  dayNum,
  items,
  isToday,
  inMonth,
  href,
}: {
  dayNum: number;
  items: CalendarItem[];
  isToday: boolean;
  inMonth: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-9 flex-col items-center gap-0.5 rounded-md py-1 text-xs transition-colors hover:bg-hover",
        isToday
          ? "bg-accent-soft font-semibold text-accent"
          : inMonth
            ? "text-text"
            : "text-muted/40",
      )}
    >
      <span className="tabular-nums">{dayNum}</span>
      {items.length > 0 ? (
        <span className="flex flex-wrap items-center justify-center gap-0.5">
          {items.slice(0, 3).map((it, i) => (
            <EventDot key={i} kind={it.kind} />
          ))}
        </span>
      ) : null}
    </Link>
  );
}
