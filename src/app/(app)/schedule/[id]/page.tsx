// Scheduled-event detail page. Edit form + lifecycle actions (done /
// skip / reopen / delete). When the user hits "Mark done", a shared.events
// row gets emitted via the same record_event pipeline every other module
// uses; the timeline and analytics consume it without knowing it came from
// the scheduler.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  describeRule,
  type RecurrenceRule,
} from "@/lib/scheduler/recurrence";

import { ScheduledEventForm } from "../ScheduledEventForm";
import {
  updateScheduledEvent,
  markScheduledEventDone,
  markScheduledEventSkipped,
  reopenScheduledEvent,
  deleteScheduledEvent,
  rematerializeSeries,
} from "../actions";

type FullRow = {
  id: string;
  domain: string;
  event_type: string;
  scheduled_for: string;
  title: string;
  notes: string | null;
  status: "planned" | "done" | "skipped" | "missed";
  completed_at: string | null;
  recurrence_rule: RecurrenceRule | null;
  parent_scheduled_id: string | null;
};

// Convert an ISO timestamp to the "YYYY-MM-DDTHH:mm" shape that
// <input type="datetime-local"> wants in local time. Server side this runs
// in UTC unless explicitly handled; for now we render in UTC and accept
// the small TZ skew - real timezone-aware formatting lands later.
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function ScheduledEventDetailPage({
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
    .from("scheduled_events")
    .select(
      "id, domain, event_type, scheduled_for, title, notes, status, completed_at, recurrence_rule, parent_scheduled_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();

  const e = row as FullRow;
  const isPlanned = e.status === "planned";
  const isTemplate = e.recurrence_rule !== null;
  const isInstance = e.parent_scheduled_id !== null;

  // If this is an instance, fetch the parent template so we can link back
  // to "manage the series." Cheap query - one row by primary key.
  type ParentTemplate = {
    id: string;
    title: string;
    recurrence_rule: RecurrenceRule | null;
  };
  let parentTemplate: ParentTemplate | null = null;
  if (isInstance && e.parent_scheduled_id) {
    const { data: parent } = await supabase
      .schema("shared")
      .from("scheduled_events")
      .select("id, title, recurrence_rule")
      .eq("id", e.parent_scheduled_id)
      .maybeSingle();
    if (parent) parentTemplate = parent as unknown as ParentTemplate;
  }

  // For templates: count how many future PLANNED instances exist so the
  // user knows the series is materialized.
  let plannedInstanceCount = 0;
  if (isTemplate) {
    const { count } = await supabase
      .schema("shared")
      .from("scheduled_events")
      .select("*", { count: "exact", head: true })
      .eq("parent_scheduled_id", id)
      .eq("status", "planned")
      .gt("scheduled_for", new Date().toISOString());
    plannedInstanceCount = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/schedule"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Schedule
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {e.title}
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {e.domain} · {e.event_type} · {formatDateTime(e.scheduled_for)}
        </p>
        <p className="text-xs">
          <StatusPill status={e.status} />
          {isTemplate ? (
            <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-violet-900 dark:bg-violet-900/60 dark:text-violet-100">
              series
            </span>
          ) : null}
          {e.completed_at ? (
            <span className="ml-2 text-zinc-500 dark:text-zinc-400">
              {formatDateTime(e.completed_at)}
            </span>
          ) : null}
        </p>
        {isTemplate && e.recurrence_rule ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Repeats {describeRule(e.recurrence_rule).toLowerCase()} ·{" "}
            {plannedInstanceCount} future instance
            {plannedInstanceCount === 1 ? "" : "s"} pre-generated
          </p>
        ) : null}
        {parentTemplate ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Part of{" "}
            <Link
              href={`/schedule/${parentTemplate.id}`}
              className="underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              {parentTemplate.title}
            </Link>
          </p>
        ) : null}
      </header>

      {flash === "created" ? <Banner kind="ok">Event scheduled ✓</Banner> : null}
      {flash === "updated" ? <Banner kind="ok">Updated ✓</Banner> : null}
      {flash === "done" ? <Banner kind="ok">Marked done. Timeline updated.</Banner> : null}
      {flash === "skipped" ? <Banner kind="ok">Skipped.</Banner> : null}
      {flash === "reopened" ? <Banner kind="ok">Re-planned.</Banner> : null}
      {flash === "rematerialized" ? (
        <Banner kind="ok">
          Re-materialized. Future planned instances regenerated from the
          current rule.
        </Banner>
      ) : null}
      {flash === "not_a_series" ? (
        <Banner kind="warn">This event isn&apos;t a recurring series.</Banner>
      ) : null}
      {flash === "event_sync_failed" ? (
        <Banner kind="warn">
          Marked done, but emitting the timeline event failed. Try again
          from this page.
        </Banner>
      ) : null}

      {/* Lifecycle actions - inline so they're never more than one tap away.
          Templates don't get done/skip; they get a re-materialize button
          instead since the series doesn't have a single completion. */}
      <div className="flex flex-wrap gap-2">
        {isTemplate ? (
          <form action={rematerializeSeries.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Re-materialize series
            </button>
          </form>
        ) : isPlanned ? (
          <>
            <form action={markScheduledEventDone.bind(null, id)}>
              <button
                type="submit"
                className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Mark done
              </button>
            </form>
            <form action={markScheduledEventSkipped.bind(null, id)}>
              <button
                type="submit"
                className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Skip
              </button>
            </form>
          </>
        ) : (
          <form action={reopenScheduledEvent.bind(null, id)}>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Re-plan
            </button>
          </form>
        )}
        <form action={deleteScheduledEvent.bind(null, id)}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Delete
          </button>
        </form>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <ScheduledEventForm
        action={updateScheduledEvent.bind(null, id)}
        submitLabel="Update event"
        defaults={{
          domain: e.domain,
          event_type: e.event_type,
          scheduled_for: isoToDatetimeLocal(e.scheduled_for),
          title: e.title,
          notes: e.notes ?? "",
          recurrence_freq: e.recurrence_rule?.freq,
          recurrence_days: e.recurrence_rule?.days,
          recurrence_until: e.recurrence_rule?.until,
        }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: FullRow["status"] }) {
  const styles: Record<FullRow["status"], string> = {
    planned: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100",
    skipped: "bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
    missed: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
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
