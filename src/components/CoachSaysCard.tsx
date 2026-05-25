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
    <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/30">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
          Coach says
        </h2>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || state.kind === "loading"}
            className="text-violet-700 underline underline-offset-4 hover:text-violet-900 disabled:opacity-50 dark:text-violet-300 dark:hover:text-violet-100"
          >
            {refreshing ? "…" : "refresh"}
          </button>
          <Link
            href="/assistant"
            className="text-violet-700 underline underline-offset-4 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
          >
            ask →
          </Link>
        </div>
      </div>

      {state.kind === "loading" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">…</p>
      ) : state.kind === "ready" ? (
        <p className="text-sm leading-snug">{state.advice}</p>
      ) : state.aiNotConfigured ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {state.message}
        </p>
      )}
    </section>
  );
}
