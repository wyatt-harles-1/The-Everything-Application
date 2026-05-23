// /lifting/start - entry point for starting a session. Two paths: blank
// session (one tap) or pick a template (lists user's templates inline).

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { startBlankSession } from "../session/actions";
import { startSessionFromTemplate } from "../templates/actions";

export default async function StartSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;

  const supabase = await createClient();
  const { data: templates } = await supabase
    .schema("wellness")
    .from("workout_templates")
    .select("id, name, description, template_exercises(exercise_name, planned_sets)")
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/lifting" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Lifting
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Start a session
        </h1>
      </header>

      {flash === "failed" ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Couldn&apos;t start the session - try again.
        </p>
      ) : null}

      <form action={startBlankSession}>
        <button
          type="submit"
          className="min-h-14 w-full rounded-lg bg-zinc-950 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Start blank session
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Or start from template
        </h2>
        {!templates || templates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No templates yet.{" "}
            <Link href="/lifting/templates/new" className="underline">
              Create one
            </Link>{" "}
            to skip the manual setup next time.
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => {
              const rows = (t.template_exercises as { exercise_name: string | null; planned_sets: unknown }[]) ?? [];
              const setCount = rows.reduce(
                (s, r) => s + ((r.planned_sets as unknown[] | null)?.length ?? 0),
                0,
              );
              return (
                <li key={t.id} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <form action={startSessionFromTemplate.bind(null, t.id)}>
                    <button
                      type="submit"
                      className="block w-full p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {rows.length} exercise{rows.length === 1 ? "" : "s"} · {setCount} planned set{setCount === 1 ? "" : "s"}
                      </p>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
