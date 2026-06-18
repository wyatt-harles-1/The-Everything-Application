// Mesocycle list page. Active block at the top, then past blocks
// chronological-desc. New-block CTA bottom.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import {
  computeMesoProgress,
  formatMesoStatusShort,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";

export default async function MesocyclesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: mesos } = await supabase
    .schema("wellness")
    .from("mesocycles")
    .select(
      "id, name, started_at, planned_weeks, deload_week_number, ended_at, notes",
    )
    .order("started_at", { ascending: false });

  const rows = (mesos ?? []) as MesocycleRow[];
  const active = rows.find((m) => m.ended_at === null) ?? null;
  const past = rows.filter((m) => m.ended_at !== null);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/lifting"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Lifting
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Mesocycles
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Multi-week training blocks. New sessions auto-tag to the active
          block.
        </p>
      </header>

      {flash === "deleted" ? (
        <Banner>Mesocycle deleted ✓</Banner>
      ) : null}

      {active ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Active
          </h2>
          <MesoCard meso={active} highlight />
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            No active block
          </h2>
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Start a mesocycle to group sessions into a training block.
          </p>
        </section>
      )}

      <Link
        href="/lifting/mesocycles/new"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Start a new mesocycle →
      </Link>

      {past.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Past blocks
          </h2>
          <ul className="space-y-1.5">
            {past.map((m) => (
              <li key={m.id}>
                <MesoCard meso={m} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MesoCard({
  meso,
  highlight,
}: {
  meso: MesocycleRow;
  highlight?: boolean;
}) {
  const active = meso.ended_at === null;
  const progress = active ? computeMesoProgress(meso) : null;
  return (
    <Link
      href={`/lifting/mesocycles/${meso.id}`}
      className={
        highlight
          ? "block rounded-lg border border-emerald-300 bg-emerald-50 p-4 shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900"
          : "block rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{meso.name}</span>
        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(meso.started_at)}
          {meso.ended_at ? ` → ${formatDate(meso.ended_at)}` : ""}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
        {progress
          ? formatMesoStatusShort(progress, meso.planned_weeks)
          : `${meso.planned_weeks}-week block`}
        {meso.deload_week_number != null
          ? ` · deload wk ${meso.deload_week_number}`
          : ""}
      </p>
    </Link>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
