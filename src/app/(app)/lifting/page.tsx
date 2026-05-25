// Lifting module hub. Wave 1 is intentionally lean - just two cards
// pointing at the exercise library + a placeholder for Wave 2 / 3 routes
// that are coming. The real session-execution UX shows up in Wave 3.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  computeMesoProgress,
  formatMesoStatusShort,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";
import { CoachSaysCard } from "@/components/CoachSaysCard";

export default async function LiftingHubPage() {
  const supabase = await createClient();

  // A quick "recent lifting sessions" panel so this page is useful even
  // before Wave 3 ships.
  const { data: recent } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("id, started_at, title, perceived_effort")
    .eq("kind", "lifting")
    .order("started_at", { ascending: false })
    .limit(5);

  // Active mesocycle (if any) - drives the "Week N of X" badge on this page
  // and is what gym-mode sessions auto-tag against.
  const { data: activeMesoRaw } = await supabase
    .schema("wellness")
    .from("mesocycles")
    .select(
      "id, name, started_at, planned_weeks, deload_week_number, ended_at",
    )
    .is("ended_at", null)
    .maybeSingle();
  const activeMeso = activeMesoRaw as MesocycleRow | null;
  const mesoProgress = activeMeso ? computeMesoProgress(activeMeso) : null;

  const { count: exerciseCount } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // Surface any in-progress lifting session so the user can resume it after
  // navigating away. A workout with started_at set but ended_at null IS the
  // session in progress.
  const { data: inProgress } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("id, started_at, title")
    .eq("kind", "lifting")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Lifting
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Library, templates, and session execution. Workouts you log here also
          flow into the timeline at /log.
        </p>
      </header>

      <CoachSaysCard domain="lifting" />

      {activeMeso && mesoProgress ? (
        <Link
          href={`/lifting/mesocycles/${activeMeso.id}`}
          className="block rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:bg-zinc-900"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active block
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold">{activeMeso.name}</span>
            <span
              className={`shrink-0 text-xs ${
                mesoProgress.isDeloadWeek
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {formatMesoStatusShort(mesoProgress, activeMeso.planned_weeks)}
            </span>
          </div>
        </Link>
      ) : null}

      {inProgress ? (
        <Link
          href={`/lifting/session/${inProgress.id}`}
          className="block rounded-lg border border-emerald-300 bg-emerald-50 p-4 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            In progress
          </p>
          <p className="mt-0.5 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
            Resume {inProgress.title ?? "session"} →
          </p>
          <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200">
            Started {formatDateTime(inProgress.started_at)}
          </p>
        </Link>
      ) : null}

      {/* Big primary CTA - gym mode is the dominant action on this page. */}
      {!inProgress ? (
        <Link
          href="/lifting/start"
          className="block min-h-16 rounded-lg bg-zinc-950 px-4 py-4 text-center text-base font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Start session →
        </Link>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <HubCard
          href="/lifting/exercises"
          label="Exercises"
          sublabel={`${exerciseCount ?? 0} in library`}
        />
        <HubCard
          href="/lifting/templates"
          label="Templates"
          sublabel="plan & re-run"
        />
        <HubCard
          href="/lifting/mesocycles"
          label="Mesocycles"
          sublabel={
            activeMeso
              ? "1 active"
              : "training blocks"
          }
        />
        <HubCard
          href="/lifting/dashboard"
          label="Dashboard"
          sublabel="volume + PRs"
        />
        <HubCard
          href="/lifting/rules"
          label="Rules"
          sublabel="auto-suggest config"
        />
        <HubCard
          href="/log/workout/new"
          label="Log workout"
          sublabel="manual / retroactive"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent lifting sessions
        </h2>
        {!recent || recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No lifting workouts yet. Log one to see it here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((w) => (
              <li
                key={w.id}
                className="rounded-md border border-zinc-200 dark:border-zinc-800"
              >
                <Link
                  href={`/log/workout/${w.id}`}
                  className="block p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">
                      {w.title ?? "Lifting session"}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(w.started_at)}
                    </span>
                  </div>
                  {w.perceived_effort != null ? (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      RPE {w.perceived_effort}/10
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HubCard({
  href,
  label,
  sublabel,
  disabled,
}: {
  href: string;
  label: string;
  sublabel: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sublabel}</span>
    </>
  );
  if (disabled) {
    return (
      <div className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-center text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
        {content}
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      {content}
    </Link>
  );
}
