// /running/shoes - active rotation up top, retired collapsed below.
// Per-shoe mileage is derived from cardio_sessions.shoe_id - no stored
// counter to drift.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { metersToMiles } from "@/lib/running/format";

type ShoeRow = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  retire_at_meters: number | null;
  started_at: string;
  retired_at: string | null;
};

export default async function ShoesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: shoeRows } = await supabase
    .schema("wellness")
    .from("shoes")
    .select(
      "id, name, brand, model, retire_at_meters, started_at, retired_at",
    )
    .order("started_at", { ascending: false });
  const shoes = (shoeRows ?? []) as ShoeRow[];

  // Per-shoe mileage tally: one query, group in JS.
  const { data: tallyRows } = await supabase
    .schema("wellness")
    .from("cardio_sessions")
    .select("shoe_id, distance_meters")
    .not("shoe_id", "is", null);
  const milesByShoe = new Map<string, number>();
  for (const r of tallyRows ?? []) {
    if (!r.shoe_id || r.distance_meters == null) continue;
    milesByShoe.set(
      r.shoe_id,
      (milesByShoe.get(r.shoe_id) ?? 0) + Number(r.distance_meters),
    );
  }

  const active = shoes.filter((s) => s.retired_at === null);
  const retired = shoes.filter((s) => s.retired_at !== null);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/running"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Running
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Shoes
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Track mileage per pair. New runs default to your active shoe.
        </p>
      </header>

      {flash === "deleted" ? <Banner>Shoe deleted ✓</Banner> : null}

      <Link
        href="/running/shoes/new"
        className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        + Add shoe
      </Link>

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No active shoes yet. Add your first pair above.
        </p>
      ) : (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active ({active.length})
          </h2>
          <ul className="space-y-1.5">
            {active.map((s) => (
              <li key={s.id}>
                <ShoeCard
                  shoe={s}
                  miles={metersToMiles(milesByShoe.get(s.id) ?? 0)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {retired.length > 0 ? (
        <details className="space-y-2">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
            Retired ({retired.length}) →
          </summary>
          <ul className="mt-2 space-y-1.5">
            {retired.map((s) => (
              <li key={s.id}>
                <ShoeCard
                  shoe={s}
                  miles={metersToMiles(milesByShoe.get(s.id) ?? 0)}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ShoeCard({ shoe, miles }: { shoe: ShoeRow; miles: number }) {
  const retireAtMiles = shoe.retire_at_meters
    ? metersToMiles(shoe.retire_at_meters)
    : null;
  const pct =
    retireAtMiles && retireAtMiles > 0
      ? Math.min(100, Math.round((miles / retireAtMiles) * 100))
      : null;
  const nearing = pct !== null && pct >= 80;
  return (
    <Link
      href={`/running/shoes/${shoe.id}`}
      className={`block rounded-md border p-3 transition-colors ${
        nearing && shoe.retired_at === null
          ? "border-amber-300 bg-amber-50/40 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{shoe.name}</span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {miles.toFixed(miles >= 10 ? 1 : 2)} mi
          {retireAtMiles ? ` / ${retireAtMiles.toFixed(0)}` : ""}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {[shoe.brand, shoe.model].filter(Boolean).join(" · ") || "—"} ·
        since {formatDate(shoe.started_at)}
        {shoe.retired_at ? ` · retired ${formatDate(shoe.retired_at)}` : ""}
      </p>
      {pct !== null ? (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full ${
              nearing
                ? "bg-amber-500"
                : "bg-zinc-700 dark:bg-zinc-300"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
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
