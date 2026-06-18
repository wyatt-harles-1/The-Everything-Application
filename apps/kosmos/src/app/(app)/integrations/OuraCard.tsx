"use client";

// Client card for the Oura integration. Same shape as StravaCard: Connect is a
// link to the OAuth authorize route; Sync / Disconnect call server actions via
// a transition and show the result inline.

import { useState, useTransition } from "react";

import { syncOura, disconnectOura, type SyncResult } from "./actions";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OuraCard({
  connected,
  configured,
  lastSynced,
  sleepCount,
  readinessCount,
}: {
  connected: boolean;
  configured: boolean;
  lastSynced: string | null;
  sleepCount: number;
  readinessCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  function runSync() {
    setResult(null);
    startTransition(async () => setResult(await syncOura()));
  }

  function runDisconnect() {
    if (
      !confirm(
        "Disconnect Oura? Already-imported sleep and readiness stay; new data just won't sync.",
      )
    ) {
      return;
    }
    setResult(null);
    startTransition(async () => setResult(await disconnectOura()));
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Oura</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sleep and daily readiness (HRV, resting HR) sync into your timeline.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            connected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {!configured ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Server credentials aren&apos;t set yet. Add <code>OURA_CLIENT_ID</code>{" "}
          and <code>OURA_CLIENT_SECRET</code> to the environment to enable Oura.
        </p>
      ) : connected ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Sleep</dt>
              <dd className="font-medium">{sleepCount}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Readiness</dt>
              <dd className="font-medium">{readinessCount}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Last synced</dt>
              <dd className="font-medium">{formatWhen(lastSynced)}</dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={runSync}
              disabled={pending}
              className="min-h-9 rounded-md bg-zinc-950 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {pending ? "Working…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={runDisconnect}
              disabled={pending}
              className="min-h-9 rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <a
          href="/api/integrations/oura/authorize"
          className="mt-4 inline-flex min-h-9 items-center rounded-md bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Connect Oura
        </a>
      )}

      {result ? (
        <p
          className={`mt-3 text-xs ${
            result.ok
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.ok
            ? (result.message ??
              `Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}.`)
            : (result.message ?? "Something went wrong.")}
        </p>
      ) : null}
    </div>
  );
}
