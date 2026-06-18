"use client";

// Inline "Coach says" card. Drops onto any module hub - pass the domain
// and it handles the rest: fetches today's cached advice on mount,
// generates fresh if there's no cache yet, and exposes a refresh
// button for the user. Failures degrade quietly (the rest of the
// module hub keeps working).

import { useEffect, useState } from "react";
import Link from "next/link";

export type CoachDomain = "lifting" | "running" | "health" | "goals";

type CoachResponse =
  | { advice: string; generated_at: string; from_cache: boolean }
  | { error: string; code?: string };

export function CoachSaysCard({ domain }: { domain: CoachDomain }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; advice: string; from_cache: boolean }
    | { kind: "error"; message: string; aiNotConfigured: boolean }
  >({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  async function load(force: boolean) {
    if (force) setRefreshing(true);
    else setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/assistant/coach-advice?domain=${domain}${force ? "&force=1" : ""}`,
      );
      const data = (await res.json()) as CoachResponse;
      if ("error" in data) {
        setState({
          kind: "error",
          message: data.error,
          aiNotConfigured: data.code === "ai_not_configured",
        });
      } else {
        setState({
          kind: "ready",
          advice: data.advice,
          from_cache: data.from_cache,
        });
      }
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Fetch failed",
        aiNotConfigured: false,
      });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  return (
    <section className="space-y-2 rounded-[var(--radius-card)] border border-border bg-accent-soft p-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">
          Coach says
        </h2>
        <div className="flex shrink-0 items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || state.kind === "loading"}
            className="font-medium text-accent hover:opacity-80 disabled:opacity-50"
          >
            {refreshing ? "…" : "refresh"}
          </button>
          <Link
            href="/assistant"
            className="font-medium text-accent hover:opacity-80"
          >
            ask →
          </Link>
        </div>
      </div>

      {state.kind === "loading" ? (
        <p className="text-sm text-muted">…</p>
      ) : state.kind === "ready" ? (
        <p className="text-sm leading-snug text-text">{state.advice}</p>
      ) : state.aiNotConfigured ? (
        <p className="text-sm text-muted">
          Set up the assistant on{" "}
          <Link
            href="/assistant/settings"
            className="underline underline-offset-4"
          >
            /assistant/settings
          </Link>{" "}
          to enable daily coach advice here.
        </p>
      ) : (
        <p className="text-sm text-warn">{state.message}</p>
      )}
    </section>
  );
}
