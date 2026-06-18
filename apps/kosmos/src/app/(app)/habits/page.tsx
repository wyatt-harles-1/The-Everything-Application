// /habits - active habits with this-week progress + streak.
// Archived habits live in a separate collapsible section below.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { computeHabitProgress } from "@/lib/scheduler/streak";

import { HabitCard } from "./HabitCard";

type HabitRow = {
  id: string;
  name: string;
  domain: string;
  event_type: string | null;
  target_frequency_per_week: number;
  active: boolean;
  started_at: string;
};

export default async function HabitsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .schema("shared")
    .from("habits")
    .select(
      "id, name, domain, event_type, target_frequency_per_week, active, started_at",
    )
    .order("started_at", { ascending: false });
  const habits = (rows ?? []) as HabitRow[];
  const active = habits.filter((h) => h.active);
  const archived = habits.filter((h) => !h.active);

  // Pull only enough events to compute progress for active habits. We
  // need ~last 60 days to compute streaks of up to ~8 weeks; query that
  // window once and filter per habit in JS.
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const { data: events } = await supabase
    .schema("shared")
    .from("events")
    .select("domain, event_type, occurred_at")
    .gte("occurred_at", sixtyDaysAgo.toISOString())
    .order("occurred_at", { ascending: true });

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
          Habits
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Per-week targets matched against the timeline. Any event of the
          right type counts - no manual check-ins.
        </p>
      </header>

      {flash === "deleted" ? <Banner>Habit deleted ✓</Banner> : null}

      <Link
        href="/habits/new"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        + New habit
      </Link>

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No active habits yet. Add your first to start tracking.
        </p>
      ) : (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active
          </h2>
          <ul className="space-y-1.5">
            {active.map((h) => {
              const matching = (events ?? []).filter(
                (e) =>
                  e.domain === h.domain &&
                  (h.event_type === null || e.event_type === h.event_type),
              );
              const progress = computeHabitProgress(
                matching,
                h.target_frequency_per_week,
                new Date(h.started_at + "T00:00:00"),
              );
              return (
                <li key={h.id}>
                  <HabitCard habit={h} progress={progress} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {archived.length > 0 ? (
        <details className="space-y-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
            Archived ({archived.length}) →
          </summary>
          <ul className="mt-2 space-y-1.5">
            {archived.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/habits/${h.id}`}
                  className="block rounded-md border border-zinc-200 p-3 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  {h.name}
                  <span className="ml-2 text-[10px] uppercase tracking-wider">
                    {h.domain}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
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
