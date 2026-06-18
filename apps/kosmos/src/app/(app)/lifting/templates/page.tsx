// /lifting/templates - list of the user's workout templates with a
// per-template "Start session" button (Strong-style quick-launch).

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { startSessionFromTemplate } from "./actions";

type ExerciseRow = {
  exercise_name: string | null;
  position: number;
  planned_sets: unknown;
};

export default async function TemplatesListPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;

  const supabase = await createClient();
  const { data: templates } = await supabase
    .schema("wellness")
    .from("workout_templates")
    .select(
      "id, name, description, updated_at, template_exercises(exercise_name, position, planned_sets)",
    )
    .order("updated_at", { ascending: false });

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
            Templates
          </h1>
          <Link href="/lifting/templates/new" className="text-sm font-medium underline underline-offset-4">
            New template →
          </Link>
        </div>
      </header>

      {flash === "deleted" ? <Banner>Template deleted.</Banner> : null}
      {flash === "not_found" ? <Banner kind="warn">Template not found.</Banner> : null}
      {flash === "start_failed" ? <Banner kind="warn">Could not start session — try again.</Banner> : null}

      {!templates || templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No templates yet. Build one once and start sessions from it weekly.
        </p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => {
            const rows = ((t.template_exercises as ExerciseRow[]) ?? []).sort(
              (a, b) => a.position - b.position,
            );
            const setCount = rows.reduce(
              (sum, r) => sum + ((r.planned_sets as unknown[] | null)?.length ?? 0),
              0,
            );
            return (
              <li
                key={t.id}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Link href={`/lifting/templates/${t.id}`} className="block p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <p className="text-sm font-semibold">{t.name}</p>
                  {t.description ? (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {rows.length} exercise{rows.length === 1 ? "" : "s"} · {setCount} planned set{setCount === 1 ? "" : "s"}
                  </p>
                  {rows.length > 0 ? (
                    <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                      {rows.slice(0, 4).map((r) => r.exercise_name ?? "?").join(" · ")}
                      {rows.length > 4 ? "…" : ""}
                    </p>
                  ) : null}
                </Link>
                <form action={startSessionFromTemplate.bind(null, t.id)} className="border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="submit"
                    className="min-h-11 w-full px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-900"
                  >
                    Start session →
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Banner({ kind = "ok", children }: { kind?: "ok" | "warn"; children: React.ReactNode }) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
