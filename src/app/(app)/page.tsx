// Authenticated home. Lightweight on purpose - /log is where most of the
// real work happens. This page is the "you just landed, what do you want to
// do" entry point: a greeting, a few quick-log shortcuts, and the most recent
// event so you can see at a glance whether you've logged anything today.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The layout already guards against unauth, so user is always present here.

  // Pull the most recent event (any type) for a quick "last logged" line.
  const { data: latestEvent } = await supabase
    .schema("shared")
    .from("events")
    .select("event_type, title, summary, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Phase 2
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Life Hub
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-950 dark:text-zinc-50">
            {user!.email}
          </span>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Quick log
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickLink href="/log/workout/new" label="Workout" />
          <QuickLink href="/log/meal/new" label="Meal" />
          <QuickLink href="/log/sleep/new" label="Sleep" />
          <QuickLink href="/log/mood/new" label="Mood" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Latest activity
        </h2>
        {latestEvent ? (
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {latestEvent.event_type}
            </p>
            <p className="mt-1 text-sm font-medium">
              {latestEvent.title ?? "(no title)"}
            </p>
            {latestEvent.summary ? (
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {latestEvent.summary}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {new Date(latestEvent.occurred_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Nothing logged yet. Pick something from Quick log above.
          </p>
        )}
        <Link
          href="/log"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Open the full log →
        </Link>
      </section>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm font-medium shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      {label}
    </Link>
  );
}
