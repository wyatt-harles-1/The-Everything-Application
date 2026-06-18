// Goal detail: stat strip (target / due / status), lifecycle actions
// (mark achieved / pause / resume / abandon / delete), then the edit form.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

import { GoalForm } from "../GoalForm";
import {
  updateGoal,
  achieveGoal,
  pauseGoal,
  resumeGoal,
  abandonGoal,
  deleteGoal,
} from "../actions";

type FullGoal = {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  category: string | null;
  target_metric: string | null;
  target_value: number | null;
  target_date: string | null;
  status: "active" | "paused" | "achieved" | "abandoned";
  priority: number;
};

function dayDiff(targetIso: string): number {
  const target = new Date(targetIso + "T23:59:59");
  const now = new Date();
  return Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default async function GoalDetailPage({
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
    .from("goals")
    .select(
      "id, title, description, domain, category, target_metric, target_value, target_date, status, priority",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();
  const g = row as FullGoal;

  const days = g.target_date ? dayDiff(g.target_date) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/goals"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Goals
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {g.title}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {g.domain}
          {g.category ? ` · ${g.category}` : ""} · priority {g.priority}
        </p>
        <p>
          <StatusPill status={g.status} />
        </p>
        {g.description ? (
          <p className="pt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {g.description}
          </p>
        ) : null}
      </header>

      {flash === "created" ? <Banner kind="ok">Goal created ✓</Banner> : null}
      {flash === "updated" ? <Banner kind="ok">Goal updated ✓</Banner> : null}
      {flash === "achieved" ? <Banner kind="ok">Marked achieved 🏆</Banner> : null}
      {flash === "paused" ? <Banner kind="ok">Goal paused.</Banner> : null}
      {flash === "resumed" ? <Banner kind="ok">Goal resumed.</Banner> : null}
      {flash === "abandoned" ? <Banner kind="ok">Goal abandoned.</Banner> : null}

      <section className="grid grid-cols-3 gap-3 rounded-lg border border-zinc-200 p-4 text-center dark:border-zinc-800">
        <Stat
          label="Target"
          value={
            g.target_value != null
              ? String(g.target_value)
              : g.target_metric || "—"
          }
          hint={g.target_metric && g.target_value != null ? g.target_metric : undefined}
        />
        <Stat
          label="Due"
          value={g.target_date ? formatDate(g.target_date) : "open"}
          hint={
            days != null
              ? days >= 0
                ? `${days}d left`
                : g.status === "active"
                  ? `${Math.abs(days)}d overdue`
                  : `${Math.abs(days)}d past`
              : undefined
          }
        />
        <Stat label="Priority" value={`P${g.priority}`} />
      </section>

      <div className="flex flex-wrap gap-2">
        {g.status === "active" ? (
          <>
            <form action={achieveGoal.bind(null, id)}>
              <button
                type="submit"
                className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Mark achieved
              </button>
            </form>
            <form action={pauseGoal.bind(null, id)}>
              <button
                type="submit"
                className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Pause
              </button>
            </form>
            <form action={abandonGoal.bind(null, id)}>
              <button
                type="submit"
                className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Abandon
              </button>
            </form>
          </>
        ) : (
          <form action={resumeGoal.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Resume
            </button>
          </form>
        )}
        <form action={deleteGoal.bind(null, id)}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete permanently
          </button>
        </form>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <GoalForm
        action={updateGoal.bind(null, id)}
        submitLabel="Update goal"
        defaults={{
          title: g.title,
          description: g.description ?? "",
          domain: g.domain,
          category: g.category ?? "",
          target_metric: g.target_metric ?? "",
          target_value: g.target_value,
          target_date: g.target_date ?? "",
          priority: g.priority,
        }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: FullGoal["status"] }) {
  const styles: Record<FullGoal["status"], string> = {
    active: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    paused: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
    achieved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
    abandoned: "bg-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
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
