// /health - aggregate hub over the wellness sub-domains that shipped in
// Phase 2 (sleep, mood, body composition, meals, medications, bloodwork,
// cycle). No new schema; the page just composes snapshot cards over the
// existing tables. Each card hides when its domain has no data so the
// page stays scannable for users who track only some of these.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { CoachSaysCard } from "@/components/CoachSaysCard";

type LatestSleep = {
  start_at: string;
  end_at: string;
  quality: number | null;
};
type LatestMood = {
  occurred_at: string;
  mood: number;
  energy: number | null;
};
type LatestBody = {
  measured_at: string;
  weight_lbs: number | null;
  body_fat_pct: number | null;
};
type LatestMeal = {
  occurred_at: string;
  description: string;
  calories: number | null;
};
type ActiveMed = {
  id: string;
  name: string;
  dosage: string | null;
};
type LatestPanel = {
  id: string;
  drawn_at: string;
  panel_type: string | null;
};
type LatestCycle = {
  occurred_at: string;
  phase: string | null;
  flow: string | null;
};

export default async function HealthHubPage() {
  const supabase = await createClient();

  // Parallelize all the per-domain reads. Each is one or two cheap rows.
  const [
    latestSleepRes,
    latestMoodRes,
    weekMoodRes,
    latestBodyRes,
    bodyMonthAgoRes,
    todaysMealsRes,
    activeMedsRes,
    todaysMedLogsRes,
    latestPanelRes,
    flaggedResultsRes,
    latestCycleRes,
    weekSleepRes,
  ] = await Promise.all([
    supabase
      .schema("wellness")
      .from("sleep_sessions")
      .select("start_at, end_at, quality")
      .order("end_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("mood_entries")
      .select("occurred_at, mood, energy")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("mood_entries")
      .select("mood")
      .gte(
        "occurred_at",
        new Date(Date.now() - 7 * 86400_000).toISOString(),
      ),
    supabase
      .schema("wellness")
      .from("body_composition")
      .select("measured_at, weight_lbs, body_fat_pct")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("body_composition")
      .select("weight_lbs, measured_at")
      .lte(
        "measured_at",
        new Date(Date.now() - 30 * 86400_000).toISOString(),
      )
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("meals")
      .select("occurred_at, description, calories")
      .gte("occurred_at", startOfTodayISO())
      .order("occurred_at", { ascending: false }),
    supabase
      .schema("wellness")
      .from("medications")
      .select("id, name, dosage")
      .is("ended_on", null)
      .order("name", { ascending: true }),
    supabase
      .schema("wellness")
      .from("medication_logs")
      .select("medication_id, skipped")
      .gte("taken_at", startOfTodayISO()),
    supabase
      .schema("wellness")
      .from("bloodwork_panels")
      .select("id, drawn_at, panel_type")
      .order("drawn_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("bloodwork_results")
      .select("id, marker_name, flag, panel_id")
      .in("flag", ["high", "low", "critical"]),
    supabase
      .schema("wellness")
      .from("cycle_entries")
      .select("occurred_at, phase, flow")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("wellness")
      .from("sleep_sessions")
      .select("start_at, end_at")
      .gte(
        "end_at",
        new Date(Date.now() - 7 * 86400_000).toISOString(),
      ),
  ]);

  const latestSleep = latestSleepRes.data as LatestSleep | null;
  const latestMood = latestMoodRes.data as LatestMood | null;
  const weekMoodValues = (weekMoodRes.data ?? []).map((r) => r.mood);
  const latestBody = latestBodyRes.data as LatestBody | null;
  const bodyMonthAgo = bodyMonthAgoRes.data as
    | { weight_lbs: number | null; measured_at: string }
    | null;
  const todaysMeals = (todaysMealsRes.data ?? []) as LatestMeal[];
  const activeMeds = (activeMedsRes.data ?? []) as ActiveMed[];
  const todaysMedLogs = todaysMedLogsRes.data ?? [];
  const latestPanel = latestPanelRes.data as LatestPanel | null;
  const flaggedResults = flaggedResultsRes.data ?? [];
  const latestCycle = latestCycleRes.data as LatestCycle | null;
  const weekSleep = weekSleepRes.data ?? [];

  // Derived numbers (computed once, reused below).
  const moodAvg =
    weekMoodValues.length > 0
      ? weekMoodValues.reduce((s, n) => s + n, 0) / weekMoodValues.length
      : null;

  const weightDelta =
    latestBody?.weight_lbs != null && bodyMonthAgo?.weight_lbs != null
      ? Number(latestBody.weight_lbs) - Number(bodyMonthAgo.weight_lbs)
      : null;

  const todaysCalories = todaysMeals.reduce(
    (s, m) => s + (m.calories ?? 0),
    0,
  );

  const takenCount = todaysMedLogs.filter((l) => !l.skipped).length;
  const skippedCount = todaysMedLogs.filter((l) => l.skipped).length;

  const flaggedInLatestPanel = latestPanel
    ? flaggedResults.filter(
        (r: { panel_id: string }) => r.panel_id === latestPanel.id,
      )
    : [];

  const weekSleepAvgMinutes =
    weekSleep.length > 0
      ? weekSleep.reduce((s, sl) => {
          const ms =
            new Date(sl.end_at).getTime() - new Date(sl.start_at).getTime();
          return s + Math.max(0, ms / 60_000);
        }, 0) / weekSleep.length
      : null;

  // Cycle module is only relevant for users who actually track it.
  const hasCycle = latestCycle !== null;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Home
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Health
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Snapshot across sleep, mood, body, meals, medications, and
          bloodwork. Each card links into the full log entry.
        </p>
      </header>

      <CoachSaysCard domain="health" />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Quick log
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <QuickLink href="/log/sleep/new" label="Sleep" />
          <QuickLink href="/log/meal/new" label="Meal" />
          <QuickLink href="/log/mood/new" label="Mood" />
          <QuickLink href="/log/body/new" label="Body" />
          <QuickLink href="/log/medication" label="Medications" />
          <QuickLink href="/log/bloodwork/new" label="Bloodwork" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* SLEEP ------------------------------------------------------- */}
        <Card title="Sleep">
          {latestSleep ? (
            <>
              <CardStat
                value={formatDuration(durationMinutes(latestSleep))}
                hint={`${latestSleep.quality ?? "—"}/10 quality`}
              />
              <CardSub>
                Last: {formatDateTime(latestSleep.end_at)}
                {weekSleepAvgMinutes != null
                  ? ` · 7d avg ${formatDuration(Math.round(weekSleepAvgMinutes))}`
                  : ""}
              </CardSub>
            </>
          ) : (
            <CardEmpty linkHref="/log/sleep/new" linkLabel="Log sleep" />
          )}
        </Card>

        {/* MOOD -------------------------------------------------------- */}
        <Card title="Mood">
          {latestMood ? (
            <>
              <CardStat
                value={`${latestMood.mood}/10`}
                hint={
                  latestMood.energy != null
                    ? `energy ${latestMood.energy}/10`
                    : "latest"
                }
              />
              <CardSub>
                {moodAvg != null
                  ? `7d avg ${moodAvg.toFixed(1)}/10 · ${weekMoodValues.length} entr${
                      weekMoodValues.length === 1 ? "y" : "ies"
                    }`
                  : `Last: ${formatDateTime(latestMood.occurred_at)}`}
              </CardSub>
            </>
          ) : (
            <CardEmpty linkHref="/log/mood/new" linkLabel="Log mood" />
          )}
        </Card>

        {/* BODY -------------------------------------------------------- */}
        <Card title="Body">
          {latestBody?.weight_lbs != null ? (
            <>
              <CardStat
                value={`${Number(latestBody.weight_lbs).toFixed(1)} lb`}
                hint={
                  latestBody.body_fat_pct != null
                    ? `${Number(latestBody.body_fat_pct).toFixed(1)}% BF`
                    : "weight"
                }
              />
              <CardSub>
                {weightDelta !== null
                  ? `${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} lb vs 30d ago`
                  : `Last: ${formatDate(latestBody.measured_at)}`}
              </CardSub>
            </>
          ) : (
            <CardEmpty linkHref="/log/body/new" linkLabel="Log body" />
          )}
        </Card>

        {/* MEALS ------------------------------------------------------- */}
        <Card title="Meals today">
          {todaysMeals.length > 0 ? (
            <>
              <CardStat
                value={String(todaysMeals.length)}
                hint={
                  todaysCalories > 0
                    ? `${todaysCalories.toLocaleString()} kcal`
                    : "logged"
                }
              />
              <CardSub>
                Latest: {todaysMeals[0].description.slice(0, 40)}
              </CardSub>
            </>
          ) : (
            <CardEmpty linkHref="/log/meal/new" linkLabel="Log a meal" />
          )}
        </Card>

        {/* MEDICATIONS ------------------------------------------------- */}
        <Card title="Medications">
          {activeMeds.length > 0 ? (
            <>
              <CardStat
                value={`${takenCount} / ${activeMeds.length}`}
                hint="taken today"
              />
              <CardSub>
                {activeMeds
                  .slice(0, 3)
                  .map((m) => m.name)
                  .join(", ")}
                {activeMeds.length > 3 ? ` +${activeMeds.length - 3}` : ""}
                {skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}
              </CardSub>
              <Link
                href="/log/medication"
                className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Manage →
              </Link>
            </>
          ) : (
            <CardEmpty linkHref="/log/medication" linkLabel="Add medication" />
          )}
        </Card>

        {/* BLOODWORK --------------------------------------------------- */}
        <Card title="Bloodwork">
          {latestPanel ? (
            <>
              <CardStat
                value={formatDate(latestPanel.drawn_at)}
                hint={latestPanel.panel_type ?? "panel"}
              />
              <CardSub>
                {flaggedInLatestPanel.length > 0
                  ? `${flaggedInLatestPanel.length} flagged result${flaggedInLatestPanel.length === 1 ? "" : "s"}`
                  : "no flagged markers"}
              </CardSub>
              <Link
                href={`/log/bloodwork/${latestPanel.id}`}
                className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Open panel →
              </Link>
            </>
          ) : (
            <CardEmpty linkHref="/log/bloodwork/new" linkLabel="Log a panel" />
          )}
        </Card>

        {/* CYCLE (conditional - only render if user tracks it) -------- */}
        {hasCycle && latestCycle ? (
          <Card title="Cycle">
            <CardStat
              value={latestCycle.phase ?? "—"}
              hint={latestCycle.flow ? `${latestCycle.flow} flow` : "phase"}
            />
            <CardSub>Last: {formatDate(latestCycle.occurred_at)}</CardSub>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

// ---------- helpers --------------------------------------------------------

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function durationMinutes(sl: { start_at: string; end_at: string }): number {
  return Math.max(
    0,
    Math.round(
      (new Date(sl.end_at).getTime() - new Date(sl.start_at).getTime()) /
        60_000,
    ),
  );
}

// ---------- card primitives -----------------------------------------------

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CardStat({ value, hint }: { value: string; hint: string }) {
  return (
    <p className="text-xl font-semibold tabular-nums">
      {value}
      <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
        {hint}
      </span>
    </p>
  );
}

function CardSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{children}</p>
  );
}

function CardEmpty({
  linkHref,
  linkLabel,
}: {
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <Link
      href={linkHref}
      className="block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      {linkLabel} →
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      {label}
    </Link>
  );
}
