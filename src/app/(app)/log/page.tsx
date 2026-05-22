// /log hub - the page you land on to add things or review what's been logged.
// Top half: a card grid of every loggable type, linking to /log/<type>/new.
// Bottom half: the last 14 days of shared.events, grouped by day, each event
// linking to its detail/edit page.
//
// As more event types arrive in Wave 2 / Wave 3, extend the `cards` list and
// the `detailPathFor` lookup. Unknown event types render without a link
// rather than crashing.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

// Card grid: keep alphabetized within each wave so future ones slot in
// naturally.
const cards: { href: string; label: string; eta?: string }[] = [
  { href: "/log/meal/new", label: "Meal" },
  { href: "/log/mood/new", label: "Mood" },
  { href: "/log/sleep/new", label: "Sleep" },
  { href: "/log/workout/new", label: "Workout" },
  { href: "/log/body/new", label: "Body comp" },
  { href: "/log/cycle/new", label: "Cycle" },
  // Medication links at the hub (not /new) because dose-logging happens there.
  { href: "/log/medication", label: "Medication" },
  { href: "/log/bloodwork/new", label: "Bloodwork" },
];

// Map event_type → URL prefix for the detail/edit page. Wave 1 covers four;
// extend as we add more.
function detailPathFor(eventType: string, detailId: string): string | null {
  switch (eventType) {
    case "workout":
      return `/log/workout/${detailId}`;
    case "meal":
      return `/log/meal/${detailId}`;
    case "sleep":
      return `/log/sleep/${detailId}`;
    case "mood_check":
      return `/log/mood/${detailId}`;
    case "body_measurement":
      return `/log/body/${detailId}`;
    case "cycle_entry":
      return `/log/cycle/${detailId}`;
    // medication_taken events don't have their own detail page in Phase 2 -
    // doses are edited on the medication hub. Just link there.
    case "medication_taken":
      return `/log/medication`;
    case "bloodwork_panel":
      return `/log/bloodwork/${detailId}`;
    default:
      return null;
  }
}

type EventRow = {
  id: string;
  event_type: string;
  occurred_at: string;
  title: string | null;
  summary: string | null;
  detail_table: string | null;
  detail_id: string | null;
};

function groupByDay(rows: EventRow[]): Array<{ day: string; events: EventRow[] }> {
  const buckets = new Map<string, EventRow[]>();
  for (const r of rows) {
    // Use UTC date for the bucket key so SSR matches client. Display below
    // formats with the user's locale.
    const d = new Date(r.occurred_at);
    const dayKey = `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1)
      .toString()
      .padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;
    const list = buckets.get(dayKey) ?? [];
    list.push(r);
    buckets.set(dayKey, list);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, events]) => ({ day, events }));
}

export default async function LogHubPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;

  const supabase = await createClient();

  // Last 14 days from now. shared.events RLS scopes to current user.
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const { data: events } = await supabase
    .schema("shared")
    .from("events")
    .select("id, event_type, occurred_at, title, summary, detail_table, detail_id")
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(200);

  const groups = groupByDay((events ?? []) as EventRow[]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Log</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pick a category to add, or review your last 14 days below.
        </p>
      </header>

      {flash === "deleted" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Entry deleted.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Add an entry
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cards.map((c) =>
            c.eta ? (
              <div
                key={c.label}
                className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
              >
                <span>{c.label}</span>
                <span className="mt-0.5 text-xs">{c.eta}</span>
              </div>
            ) : (
              <Link
                key={c.label}
                href={c.href}
                className="flex min-h-20 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-3 text-center text-sm font-medium shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
              >
                {c.label}
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Last 14 days
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Nothing yet. Log something from above and it&apos;ll appear here.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map(({ day, events }) => (
              <div key={day} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {formatDate(`${day}T00:00:00Z`)}
                </p>
                <ul className="space-y-1.5">
                  {events.map((e) => {
                    const href = e.detail_id
                      ? detailPathFor(e.event_type, e.detail_id)
                      : null;
                    const content = (
                      <>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium">
                            {e.title ?? e.event_type}
                          </span>
                          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(e.occurred_at).toLocaleTimeString(
                              undefined,
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </span>
                        </div>
                        {e.summary ? (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {e.summary}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          {e.event_type}
                        </p>
                      </>
                    );
                    return (
                      <li
                        key={e.id}
                        className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        {href ? (
                          <Link
                            href={href}
                            className="block rounded -m-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          >
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

