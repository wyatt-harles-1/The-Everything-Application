// Home "Calendar" widget: a compact current-month grid (event/goal dots) plus
// today's agenda. Tapping a day opens the full /calendar on that day. Server
// component — computes the grid with date-fns; no client JS.

import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
} from "date-fns";

import { Card } from "@/components/ui/Card";
import { DayCell } from "@/components/calendar/DayCell";
import { EventDot } from "@/components/calendar/EventDot";
import { groupByDay, type CalendarItem } from "@/lib/calendar/types";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function CalendarWidget({ items }: { items: CalendarItem[] }) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(today), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = groupByDay(items);
  const todayKey = format(today, "yyyy-MM-dd");
  const todays = byDay.get(todayKey) ?? [];

  return (
    <section>
      <Card>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-text">
            {format(today, "MMMM yyyy")}
          </h2>
          <Link
            href="/calendar"
            className="text-xs font-medium text-accent hover:opacity-80"
          >
            open →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            return (
              <DayCell
                key={key}
                dayNum={d.getDate()}
                items={byDay.get(key) ?? []}
                isToday={isSameDay(d, today)}
                inMonth={isSameMonth(d, monthStart)}
                href={`/calendar?view=day&date=${key}`}
              />
            );
          })}
        </div>

        {todays.length > 0 ? (
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Today
            </p>
            {todays.map((it) => (
              <Link
                key={`${it.kind}-${it.id}`}
                href={it.href}
                className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-text transition-colors hover:bg-hover"
              >
                <EventDot kind={it.kind} />
                <span className="truncate">{it.title}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
