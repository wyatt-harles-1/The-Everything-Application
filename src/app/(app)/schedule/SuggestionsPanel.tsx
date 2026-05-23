// Client component: renders an "Accept" button per suggestion that calls
// the acceptSuggestion Server Action. Dismissed suggestions just hide
// client-side (not persisted - next page load shows them again unless
// they've been accepted in the meantime).

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { acceptSuggestion } from "./actions";

export type Suggestion = {
  // Stable client-side key (date-string is enough since no two suggestions
  // ever share a slot).
  key: string;
  scheduled_for: string;
  domain: string;
  event_type: string;
  title: string;
  // Pre-formatted display strings - server-rendered to avoid TZ jitter.
  dayLabel: string;
  timeLabel: string;
};

export function SuggestionsPanel({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();

  const visible = suggestions.filter((s) => !hidden.has(s.key));
  if (visible.length === 0) return null;

  function onAccept(s: Suggestion) {
    setBusy((prev) => new Set(prev).add(s.key));
    acceptSuggestion({
      scheduled_for: s.scheduled_for,
      domain: s.domain,
      event_type: s.event_type,
      title: s.title,
    })
      .then((res) => {
        if (res.ok) {
          setHidden((prev) => new Set(prev).add(s.key));
          startTransition(() => router.refresh());
        }
      })
      .catch(console.error)
      .finally(() => {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(s.key);
          return next;
        });
      });
  }

  function onDismiss(s: Suggestion) {
    setHidden((prev) => new Set(prev).add(s.key));
  }

  function onAcceptAll() {
    // Fire them in series so the eventual scheduled_events list orders
    // sensibly; parallel inserts can race the unique-ish ordering.
    (async () => {
      for (const s of visible) {
        setBusy((prev) => new Set(prev).add(s.key));
        try {
          const res = await acceptSuggestion({
            scheduled_for: s.scheduled_for,
            domain: s.domain,
            event_type: s.event_type,
            title: s.title,
          });
          if (res.ok) {
            setHidden((prev) => new Set(prev).add(s.key));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setBusy((prev) => {
            const next = new Set(prev);
            next.delete(s.key);
            return next;
          });
        }
      }
      startTransition(() => router.refresh());
    })();
  }

  return (
    <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/30">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
          Suggestions
        </h2>
        <button
          type="button"
          onClick={onAcceptAll}
          className="text-xs font-medium text-violet-700 underline underline-offset-4 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
        >
          Accept all
        </button>
      </div>
      <ul className="space-y-1.5">
        {visible.map((s) => {
          const isBusy = busy.has(s.key);
          return (
            <li
              key={s.key}
              className="flex items-center gap-2 rounded-md border border-violet-200 bg-white p-2.5 dark:border-violet-900 dark:bg-zinc-950"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {s.dayLabel} · {s.timeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAccept(s)}
                disabled={isBusy}
                className="min-h-9 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isBusy ? "…" : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => onDismiss(s)}
                aria-label="Dismiss"
                className="h-9 w-8 text-xs text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Based on your lifting rules + active mesocycle.{" "}
        <a
          href="/lifting/rules"
          className="underline underline-offset-2 hover:text-zinc-950 dark:hover:text-zinc-50"
        >
          Tune them
        </a>
      </p>
    </section>
  );
}
