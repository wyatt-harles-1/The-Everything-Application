// "Today": an in-progress lifting session (if any) plus today's planned events.

import Link from "next/link";

import { formatDateTime, formatTime } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";

export type TodaySession = { id: string; title: string | null; started_at: string };
export type TodayScheduled = {
  id: string;
  domain: string;
  event_type: string;
  scheduled_for: string;
  title: string;
};

export function TodayWidget({
  inProgressSession,
  scheduled,
}: {
  inProgressSession: TodaySession | null;
  scheduled: TodayScheduled[];
}) {
  return (
    <section>
      <SectionHeader title="Today" />
      <div className="space-y-2">
        {inProgressSession ? (
          <Link
            href={`/lifting/session/${inProgressSession.id}`}
            className="block rounded-[var(--radius-card)] border border-success/40 bg-success-soft p-4 transition-opacity hover:opacity-90"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-success">
              In progress
            </p>
            <p className="mt-0.5 text-sm font-semibold text-text">
              Resume {inProgressSession.title ?? "session"} →
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Started {formatDateTime(inProgressSession.started_at)}
            </p>
          </Link>
        ) : null}
        {scheduled.length > 0 ? (
          <ul className="space-y-1.5">
            {scheduled.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/schedule/${s.id}`}
                  className="block rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-colors hover:bg-hover"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-text">{s.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                      {formatTime(s.scheduled_for)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">
                    {s.domain} · {s.event_type}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
