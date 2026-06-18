// Habit detail: header with streak + this-week progress, the edit form,
// archive/unarchive + delete actions, and a per-week history grid (last
// 12 weeks) so the user can see the pattern at a glance.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import {
  computeHabitProgress,
  startOfISOWeek,
} from "@/lib/scheduler/streak";

import { HabitForm } from "../HabitForm";
import {
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  deleteHabit,
} from "../actions";

type FullHabit = {
  id: string;
  name: string;
  domain: string;
  event_type: string | null;
  target_frequency_per_week: number;
  active: boolean;
  started_at: string;
  notes: string | null;
};

export default async function HabitDetailPage({
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
    .schema("shared")
    .from("habits")
    .select(
      "id, name, domain, event_type, target_frequency_per_week, active, started_at, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();
  const h = row as FullHabit;

  // Pull events from the last 12 weeks for the grid. Filtered to the
  // habit's domain + optional event_type.
  const since = new Date();
  since.setDate(since.getDate() - 12 * 7);
  let query = supabase
    .schema("shared")
    .from("events")
    .select("occurred_at, event_type")
    .eq("domain", h.domain)
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: true });
  if (h.event_type) query = query.eq("event_type", h.event_type);
  const { data: events } = await query;
  const occ = (events ?? []).map((e) => ({ occurred_at: e.occurred_at }));

  const progress = computeHabitProgress(
    occ,
    h.target_frequency_per_week,
    new Date(h.started_at + "T00:00:00"),
  );

  // Per-week counts for the last 12 weeks (oldest -> newest).
  const weekStarts: Date[] = [];
  const now = new Date();
  const thisWeekStart = startOfISOWeek(now);
  for (let i = 11; i >= 0; i--) {
    const ws = new Date(thisWeekStart);
    ws.setDate(ws.getDate() - i * 7);
    weekStarts.push(ws);
  }
  const weekCounts = weekStarts.map((ws) => {
    const next = new Date(ws);
    next.setDate(next.getDate() + 7);
    return occ.filter((e) => {
      const t = new Date(e.occurred_at);
      return t >= ws && t < next;
    }).length;
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/habits"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Habits
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {h.name}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {h.domain}
          {h.event_type ? ` · ${h.event_type}` : ""} ·{" "}
          {h.target_frequency_per_week}/week · started{" "}
          {formatDate(h.started_at)}
          {!h.active ? " · archived" : ""}
        </p>
      </header>

      {flash === "created" ? <Banner kind="ok">Habit created ✓</Banner> : null}
      {flash === "updated" ? <Banner kind="ok">Habit updated ✓</Banner> : null}
      {flash === "archived" ? <Banner kind="ok">Habit archived.</Banner> : null}
      {flash === "unarchived" ? <Banner kind="ok">Habit restored.</Banner> : null}

      <section className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 p-4 text-center dark:border-zinc-800">
        <Stat
          label="This week"
          value={`${progress.thisWeekCount}/${progress.target}`}
          hint={progress.thisWeekMet ? "met ✓" : progress.isStreakAlive ? "alive" : "at risk"}
        />
        <Stat
          label="Streak"
          value={`${progress.streakWeeks}wk`}
          hint={progress.streakWeeks > 0 ? "🔥" : "—"}
        />
        <Stat
          label="Last 12 wks"
          value={`${weekCounts.reduce((s, n) => s + n, 0)}`}
          hint="completions"
        />
      </section>

      {/* Weekly bar grid - oldest left, this week right. Filled bars hit
          target; partial bars hit some completions; empty = miss. */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Last 12 weeks
        </h2>
        <div className="flex items-end gap-1.5">
          {weekCounts.map((c, i) => {
            const met = c >= h.target_frequency_per_week;
            const heightPct = Math.min(
              100,
              Math.round((c / Math.max(h.target_frequency_per_week, 1)) * 100),
            );
            const isCurrent = i === weekCounts.length - 1;
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${weekStarts[i].toLocaleDateString()}: ${c}`}
              >
                <div className="flex h-14 w-full items-end overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`w-full ${
                      met
                        ? "bg-emerald-500"
                        : c > 0
                          ? "bg-zinc-400 dark:bg-zinc-500"
                          : ""
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] tabular-nums ${
                    isCurrent
                      ? "font-medium text-zinc-950 dark:text-zinc-50"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {c}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <HabitForm
        action={updateHabit.bind(null, id)}
        submitLabel="Update habit"
        defaults={{
          name: h.name,
          domain: h.domain,
          event_type: h.event_type ?? "",
          target_frequency_per_week: h.target_frequency_per_week,
          started_at: h.started_at,
          notes: h.notes ?? "",
        }}
      />

      <div className="flex flex-wrap gap-2">
        {h.active ? (
          <form action={archiveHabit.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Archive
            </button>
          </form>
        ) : (
          <form action={unarchiveHabit.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Restore
            </button>
          </form>
        )}
        <form action={deleteHabit.bind(null, id)}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete permanently
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {hint}
      </p>
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
