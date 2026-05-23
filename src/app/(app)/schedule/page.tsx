// /schedule - list of planned scheduled_events grouped by section (today,
// tomorrow, this week, later, past). One-off events only in 4a1; recurrence
// + calendar view land in 4a2.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

type ScheduledRow = {
  id: string;
  domain: string;
  event_type: string;
  scheduled_for: string;
  title: string;
  notes: string | null;
  status: "planned" | "done" | "skipped" | "missed";
};

type Section = {
  label: string;
  events: ScheduledRow[];
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function groupByDate(events: ScheduledRow[]): Section[] {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfThisWeek = new Date(today);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 7);

  const past: ScheduledRow[] = [];
  const todays: ScheduledRow[] = [];
  const tomorrows: ScheduledRow[] = [];
  const thisWeek: ScheduledRow[] = [];
  const later: ScheduledRow[] = [];

  for (const e of events) {
    const when = new Date(e.scheduled_for);
    if (when < today) past.push(e);
    else if (when < tomorrow) todays.push(e);
    else if (when < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000))
      tomorrows.push(e);
    else if (when < endOfThisWeek) thisWeek.push(e);
    else later.push(e);
  }

  return [
    { label: "Today", events: todays },
    { label: "Tomorrow", events: tomorrows },
    { label: "This week", events: thisWeek },
    { label: "Later", events: later },
    { label: "Past (still planned)", events: past },
  ].filter((s) => s.events.length > 0);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  // Upcoming + recent planned events. Done/skipped land elsewhere via the
  // detail page; the schedule list focuses on what's still on the agenda.
  const { data: rows } = await supabase
    .schema("shared")
    .from("scheduled_events")
    .select(
      "id, domain, event_type, scheduled_for, title, notes, status",
    )
    .eq("status", "planned")
    .order("scheduled_for", { ascending: true });

  const events = (rows ?? []) as ScheduledRow[];
  const sections = groupByDate(events);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Home
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Schedule
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          What&apos;s planned. Mark items done from the detail view to feed
          the timeline.
        </p>
      </header>

      {flash === "deleted" ? <Banner>Event deleted ✓</Banner> : null}

      <Link
        href="/schedule/new"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        + Add to schedule
      </Link>

      {sections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nothing on the schedule yet. Add the first thing above.
        </p>
      ) : (
        sections.map((s) => (
          <section key={s.label} className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {s.label}
            </h2>
            <ul className="space-y-1.5">
              {s.events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/schedule/${e.id}`}
                    className="block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{e.title}</span>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDateTime(e.scheduled_for)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {e.domain} · {e.event_type}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
