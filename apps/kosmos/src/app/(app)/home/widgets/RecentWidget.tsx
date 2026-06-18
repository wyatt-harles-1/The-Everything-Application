// "Recent activity": the latest events across every domain.

import { formatDateTime } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";

export type RecentEvent = {
  event_type: string;
  title: string | null;
  summary: string | null;
  occurred_at: string;
};

export function RecentWidget({ events }: { events: RecentEvent[] }) {
  return (
    <section>
      <SectionHeader title="Recent activity" action={{ href: "/log", label: "full log →" }} />
      <ul className="space-y-1">
        {events.map((e, idx) => (
          <li
            key={`${e.occurred_at}-${idx}`}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-text">
                {e.title ?? e.event_type}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {formatDateTime(e.occurred_at)}
              </span>
            </div>
            {e.summary ? (
              <p className="mt-0.5 text-xs text-muted">{e.summary}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
