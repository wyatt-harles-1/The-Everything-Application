// /lifting/exercises - the library list. Groups by muscle group, surfaces
// an "Add exercise" link, and offers a one-click seed for users starting
// with an empty library.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { seedStarterExercises } from "../actions";

export default async function ExercisesListPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;

  const supabase = await createClient();
  const { data: exercises } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("id, name, muscle_group, equipment, is_active")
    .order("muscle_group", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  const active = (exercises ?? []).filter((e) => e.is_active);
  const archived = (exercises ?? []).filter((e) => !e.is_active);

  // Group by muscle so the list scans well; one bucket per group, ordered
  // by name within.
  const byGroup = new Map<string, typeof active>();
  for (const e of active) {
    const key = e.muscle_group ?? "ungrouped";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(e);
  }
  const groups = Array.from(byGroup.entries()).sort(([a], [b]) =>
    a === "ungrouped" ? 1 : b === "ungrouped" ? -1 : a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/lifting"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Lifting
        </Link>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Exercises
          </h1>
          <Link
            href="/lifting/exercises/new"
            className="text-sm font-medium underline underline-offset-4"
          >
            Add exercise →
          </Link>
        </div>
      </header>

      <FlashFor flash={flash} />

      {active.length === 0 ? (
        <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your library is empty. Seed it with ~30 common lifts to get started.
          </p>
          <form action={seedStarterExercises}>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Seed starter exercises
            </button>
          </form>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Or add custom ones one at a time via the link above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([group, items]) => (
            <section key={group} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {group === "ungrouped" ? "Other" : group.replace("_", " ")}
              </h2>
              <ul className="space-y-1">
                {items.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/lifting/exercises/${e.id}`}
                      className="flex items-baseline justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                    >
                      <span className="text-sm font-medium">{e.name}</span>
                      {e.equipment ? (
                        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          {e.equipment}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Archived ({archived.length})
          </h2>
          <ul className="space-y-1">
            {archived.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/lifting/exercises/${e.id}`}
                  className="block rounded-md border border-dashed border-zinc-200 p-3 text-sm opacity-70 transition-colors hover:bg-zinc-50 hover:opacity-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  {e.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FlashFor({ flash }: { flash?: string }) {
  if (!flash) return null;
  if (flash.startsWith("seeded_")) {
    const n = flash.slice("seeded_".length);
    return (
      <Banner kind="ok">
        Added {n} starter exercise{n === "1" ? "" : "s"} to your library.
      </Banner>
    );
  }
  if (flash === "archived") return <Banner kind="warn">Exercise archived.</Banner>;
  if (flash === "deleted") return <Banner kind="warn">Exercise deleted.</Banner>;
  return null;
}

function Banner({
  kind,
  children,
}: {
  kind: "ok" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
