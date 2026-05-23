// /goals - active goals sorted by priority, then archived/achieved/paused
// in collapsible sections below.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { GoalCard, type GoalForCard } from "./GoalCard";

export default async function GoalsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .schema("shared")
    .from("goals")
    .select(
      "id, title, domain, category, target_metric, target_value, target_date, priority, status",
    )
    // Active first (sorted by priority asc = highest first), then everything
    // else by updated_at desc. Index covers (user_id, status, priority).
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false });
  const goals = (rows ?? []) as GoalForCard[];

  const active = goals.filter((g) => g.status === "active");
  const paused = goals.filter((g) => g.status === "paused");
  const achieved = goals.filter((g) => g.status === "achieved");
  const abandoned = goals.filter((g) => g.status === "abandoned");

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
          Goals
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          What you&apos;re working toward. Across every domain - lifting,
          health, finance, knowledge.
        </p>
      </header>

      {flash === "deleted" ? <Banner>Goal deleted ✓</Banner> : null}

      <Link
        href="/goals/new"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        + New goal
      </Link>

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No active goals yet. Add your first to start tracking.
        </p>
      ) : (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active ({active.length})
          </h2>
          <ul className="space-y-1.5">
            {active.map((g) => (
              <li key={g.id}>
                <GoalCard goal={g} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {paused.length > 0 ? (
        <CollapsibleSection label={`Paused (${paused.length})`} goals={paused} />
      ) : null}
      {achieved.length > 0 ? (
        <CollapsibleSection label={`Achieved (${achieved.length})`} goals={achieved} defaultOpen />
      ) : null}
      {abandoned.length > 0 ? (
        <CollapsibleSection label={`Abandoned (${abandoned.length})`} goals={abandoned} />
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  label,
  goals,
  defaultOpen,
}: {
  label: string;
  goals: GoalForCard[];
  defaultOpen?: boolean;
}) {
  return (
    <details className="space-y-2" {...(defaultOpen ? { open: true } : {})}>
      <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
        {label} →
      </summary>
      <ul className="mt-2 space-y-1.5">
        {goals.map((g) => (
          <li key={g.id}>
            <GoalCard goal={g} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
