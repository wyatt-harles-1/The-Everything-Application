// Lifting module hub. Wave 1 is intentionally lean - just two cards
// pointing at the exercise library + a placeholder for Wave 2 / 3 routes
// that are coming. The real session-execution UX shows up in Wave 3.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

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

      <section className="grid grid-cols-2 gap-3">
        <HubCard
          href="/lifting/exercises"
          label="Exercises"
          sublabel={`${exerciseCount ?? 0} in library`}
        />
        <HubCard
          href="/log/workout/new"
          label="Log workout"
          sublabel="manual / retroactive"
        />
        <HubCard
          href="/lifting/templates"
          label="Templates"
          sublabel="plan & re-run"
        />
        <HubCard
          href="/lifting/start"
          label="Start session"
          sublabel="gym mode"
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
