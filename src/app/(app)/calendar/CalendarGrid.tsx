// Client calendar renderer: a toolbar (prev / today / next + month/week/day
// toggle) over one of three views. Navigation just pushes ?view&date — the
// server refetches the right range. Data math is date-fns; styling is tokens.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  addWeeks,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";

import { cn } from "@/lib/cn";
import { EventDot } from "@/components/calendar/EventDot";
import { groupByDay, type CalendarItem } from "@/lib/calendar/types";

export type CalendarView = "month" | "week" | "day";

const WEEK_OPTS = { weekStartsOn: 1 as const };
const VIEWS: CalendarView[] = ["month", "week", "day"];

export function CalendarGrid({
  items,
  view,
  anchorISO,
}: {
  items: CalendarItem[];
  view: CalendarView;
  anchorISO: string;
}) {
  const router = useRouter();
  const anchor = parseISO(anchorISO);
  const today = new Date();
  const byDay = groupByDay(items);

  const go = (v: CalendarView, date: Date) =>
    router.push(`/calendar?view=${v}&date=${format(date, "yyyy-MM-dd")}`);

  const step = (dir: number) => {
    const next =
      view === "month"
        ? addMonths(anchor, dir)
        : view === "week"
          ? addWeeks(anchor, dir)
          : addDays(anchor, dir);
    go(view, next);
  };

  const periodLabel =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "week"
        ? `Week of ${format(startOfWeek(anchor, WEEK_OPTS), "MMM d")}`
        : format(anchor, "EEEE, MMM d");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-hover hover:text-text"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(view, today)}
            className="h-8 rounded-md border border-border px-3 text-xs font-medium text-text transition-colors hover:bg-hover"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-hover hover:text-text"
          >
            ›
          </button>
        </div>
        <span className="text-sm font-semibold text-text">{periodLabel}</span>
        <div className="flex rounded-[var(--radius-card)] border border-border p-0.5 text-xs">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => go(v, anchor)}
              className={cn(
                "rounded-md px-2.5 py-1 capitalize transition-colors",
                v === view
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:text-text",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <MonthView anchor={anchor} today={today} byDay={byDay} onDay={(d) => go("day", d)} />
      ) : view === "week" ? (
        <WeekView anchor={anchor} today={today} byDay={byDay} />
      ) : (
        <DayView anchor={anchor} byDay={byDay} />
      )}
    </div>
  );
}

function ItemRow({ item }: { item: CalendarItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text transition-colors hover:bg-hover"
    >
      <EventDot kind={item.kind} />
      <span className="truncate">{item.title}</span>
      {item.domain ? (
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-muted">
          {item.domain}
        </span>
      ) : null}
    </Link>
  );
}

function MonthView({
  anchor,
  today,
  byDay,
  onDay,
}: {
  anchor: Date;
  today: Date;
  byDay: Map<string, CalendarItem[]>;
  onDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, WEEK_OPTS);
  const gridEnd = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayItems = byDay.get(key) ?? [];
          const inMonth = isSameMonth(d, monthStart);
          const isToday = isSameDay(d, today);
          return (
            <button
              type="button"
              key={key}
              onClick={() => onDay(d)}
              className={cn(
                "flex min-h-16 flex-col gap-1 rounded-md border border-border p-1 text-left transition-colors hover:bg-hover",
                !inMonth && "opacity-50",
                isToday && "border-accent",
              )}
            >
              <span
                className={cn(
                  "text-xs tabular-nums",
                  isToday ? "font-semibold text-accent" : "text-muted",
                )}
              >
                {d.getDate()}
              </span>
              <span className="flex flex-col gap-0.5 overflow-hidden">
                {dayItems.slice(0, 2).map((it) => (
                  <span
                    key={`${it.kind}-${it.id}`}
                    className="flex items-center gap-1 truncate text-[10px] text-text"
                  >
                    <EventDot kind={it.kind} />
                    <span className="truncate">{it.title}</span>
                  </span>
                ))}
                {dayItems.length > 2 ? (
                  <span className="text-[10px] text-muted">
                    +{dayItems.length - 2} more
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  anchor,
  today,
  byDay,
}: {
  anchor: Date;
  today: Date;
  byDay: Map<string, CalendarItem[]>;
}) {
  const start = startOfWeek(anchor, WEEK_OPTS);
  const days = eachDayOfInterval({ start, end: endOfWeek(anchor, WEEK_OPTS) });

  return (
    <div className="space-y-2">
      {days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const dayItems = byDay.get(key) ?? [];
        const isToday = isSameDay(d, today);
        return (
          <div
            key={key}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-2"
          >
            <p
              className={cn(
                "mb-1 px-1 text-xs font-medium",
                isToday ? "text-accent" : "text-muted",
              )}
            >
              {format(d, "EEE, MMM d")}
            </p>
            {dayItems.length > 0 ? (
              <div className="space-y-0.5">
                {dayItems.map((it) => (
                  <ItemRow key={`${it.kind}-${it.id}`} item={it} />
                ))}
              </div>
            ) : (
              <p className="px-2 py-1 text-xs text-muted">—</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  anchor,
  byDay,
}: {
  anchor: Date;
  byDay: Map<string, CalendarItem[]>;
}) {
  const key = format(anchor, "yyyy-MM-dd");
  const dayItems = byDay.get(key) ?? [];

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-2">
      {dayItems.length > 0 ? (
        <div className="space-y-0.5">
          {dayItems.map((it) => (
            <ItemRow key={`${it.kind}-${it.id}`} item={it} />
          ))}
        </div>
      ) : (
        <p className="px-2 py-6 text-center text-sm text-muted">
          Nothing scheduled for this day.
        </p>
      )}
    </div>
  );
}
