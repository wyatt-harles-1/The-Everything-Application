// /calendar — the full month/week/day grid view. Complements /schedule (which
// keeps the agenda, suggestions, and recurring-series management). Server
// computes the visible range from ?view & ?date and fetches items; the client
// CalendarGrid handles rendering + navigation.

import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  parseISO,
  isValid,
  format,
} from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { fetchCalendarItems } from "@/lib/calendar/data";

import { CalendarGrid, type CalendarView } from "./CalendarGrid";

const WEEK_OPTS = { weekStartsOn: 1 as const };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const view: CalendarView =
    sp.view === "week" ? "week" : sp.view === "day" ? "day" : "month";
  const anchor =
    sp.date && isValid(parseISO(sp.date)) ? parseISO(sp.date) : new Date();

  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "month") {
    rangeStart = startOfWeek(startOfMonth(anchor), WEEK_OPTS);
    rangeEnd = endOfWeek(endOfMonth(anchor), WEEK_OPTS);
  } else if (view === "week") {
    rangeStart = startOfWeek(anchor, WEEK_OPTS);
    rangeEnd = endOfWeek(anchor, WEEK_OPTS);
  } else {
    rangeStart = startOfDay(anchor);
    rangeEnd = endOfDay(anchor);
  }

  const items = await fetchCalendarItems(
    supabase,
    rangeStart.toISOString(),
    addDays(rangeEnd, 1).toISOString(),
  );

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-xs text-muted transition-colors hover:text-text"
        >
          ← Home
        </Link>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
            Calendar
          </h1>
          <Link
            href="/schedule"
            className="text-xs font-medium text-accent hover:opacity-80"
          >
            Agenda →
          </Link>
        </div>
      </header>

      <CalendarGrid
        items={items}
        view={view}
        anchorISO={format(anchor, "yyyy-MM-dd")}
      />
    </div>
  );
}
