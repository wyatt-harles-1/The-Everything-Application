// Shoe detail: mileage tally, edit form, retire/restore/delete actions.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMiles, metersToMiles } from "@/lib/running/format";

import { ShoeForm } from "../ShoeForm";
import {
  updateShoe,
  retireShoe,
  restoreShoe,
  deleteShoe,
} from "../actions";

type FullShoe = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  retire_at_meters: number | null;
  started_at: string;
  retired_at: string | null;
  notes: string | null;
};

export default async function ShoeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .schema("wellness")
    .from("shoes")
    .select(
      "id, name, brand, model, retire_at_meters, started_at, retired_at, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();
  const s = row as FullShoe;

  // Mileage tally from linked cardio_sessions.
  const { data: tally } = await supabase
    .schema("wellness")
    .from("cardio_sessions")
    .select("distance_meters")
    .eq("shoe_id", id);
  let totalMeters = 0;
  for (const r of tally ?? []) {
    if (r.distance_meters != null) totalMeters += Number(r.distance_meters);
  }
  const totalMiles = metersToMiles(totalMeters);
  const retireAtMiles = s.retire_at_meters
    ? metersToMiles(s.retire_at_meters)
    : null;
  const pct =
    retireAtMiles && retireAtMiles > 0
      ? Math.min(100, Math.round((totalMiles / retireAtMiles) * 100))
      : null;

  // Recent runs on this shoe.
  const { data: recent } = await supabase
    .schema("wellness")
    .from("cardio_sessions")
    .select(
      "id, distance_meters, duration_seconds, workouts:workout_id(id, started_at, title)",
    )
    .eq("shoe_id", id)
    .order("created_at", { ascending: false })
    .limit(10);
  type RecentRun = {
    id: string;
    distance_meters: number | null;
    duration_seconds: number | null;
    workouts:
      | { id: string; started_at: string; title: string | null }
      | { id: string; started_at: string; title: string | null }[]
      | null;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/running/shoes"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Shoes
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {s.name}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {[s.brand, s.model].filter(Boolean).join(" · ") || "—"} · since{" "}
          {formatDate(s.started_at)}
          {s.retired_at ? ` · retired ${formatDate(s.retired_at)}` : ""}
        </p>
      </header>

      {flash === "created" ? <Banner kind="ok">Shoe added ✓</Banner> : null}
      {flash === "updated" ? <Banner kind="ok">Shoe updated ✓</Banner> : null}
      {flash === "retired" ? <Banner kind="ok">Shoe retired.</Banner> : null}
      {flash === "restored" ? <Banner kind="ok">Shoe restored.</Banner> : null}

      <section className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Mileage
          </p>
          <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {totalMiles.toFixed(totalMiles >= 10 ? 1 : 2)} mi
            {retireAtMiles ? ` / ${retireAtMiles.toFixed(0)} mi target` : ""}
          </p>
        </div>
        {pct !== null ? (
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full ${pct >= 80 ? "bg-amber-500" : "bg-zinc-700 dark:bg-zinc-300"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {s.retired_at === null ? (
          <form action={retireShoe.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Retire
            </button>
          </form>
        ) : (
          <form action={restoreShoe.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Restore
            </button>
          </form>
        )}
        <form action={deleteShoe.bind(null, id)}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete permanently
          </button>
        </form>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <ShoeForm
        action={updateShoe.bind(null, id)}
        submitLabel="Update shoe"
        defaults={{
          name: s.name,
          brand: s.brand ?? "",
          model: s.model ?? "",
          retire_at_miles: retireAtMiles,
          started_at: s.started_at,
          retired_at: s.retired_at ?? "",
          notes: s.notes ?? "",
        }}
      />

      {recent && recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Recent runs
          </h2>
          <ul className="space-y-1">
            {(recent as RecentRun[]).map((r) => {
              const w = Array.isArray(r.workouts)
                ? r.workouts[0]
                : r.workouts;
              return (
                <li key={r.id}>
                  <Link
                    href={w ? `/log/workout/${w.id}` : "#"}
                    className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {w?.title ?? "Run"}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {w ? formatDateTime(w.started_at) : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatMiles(r.distance_meters)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
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
