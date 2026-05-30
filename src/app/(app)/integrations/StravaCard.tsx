"use client";

// Client card for the Strava integration. Connect is a plain link to the
// OAuth authorize route; Sync / Disconnect call server actions via a
// transition and show the result inline. After an action with
// revalidatePath, Next re-renders the server page and updates these props
// (connected state, imported count, last-synced).

import { useState, useTransition } from "react";

import { syncStrava, disconnectStrava, type SyncResult } from "./actions";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StravaCard({
  connected,
  configured,
  athleteId,
  lastSynced,
  importedCount,
}: {
  connected: boolean;
  configured: boolean;
  athleteId: number | null;
  lastSynced: string | null;
  importedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  function runSync() {
    setResult(null);
    startTransition(async () => setResult(await syncStrava()));
  }

  function runDisconnect() {
    if (
      !confirm(
        "Disconnect Strava? Already-imported activities stay; new ones just won't sync.",
      )
    ) {
      return;
    }
    setResult(null);
    startTransition(async () => setResult(await disconnectStrava()));
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Strava</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Runs, rides, swims, and walks sync into your timeline.
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
          Server credentials aren&apos;t set yet. Add{" "}
          <code>STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code> to
          the environment to enable Strava.
        </p>
      ) : connected ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Athlete</dt>
              <dd className="font-medium">{athleteId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Imported</dt>
              <dd className="font-medium">{importedCount}</dd>
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
          href="/api/integrations/strava/authorize"
          className="mt-4 inline-flex min-h-9 items-center rounded-md bg-[#fc4c02] px-3 text-xs font-medium text-white hover:bg-[#e34402]"
        >
          Connect Strava
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
            ? result.message ??
              `Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}.`
            : (result.message ?? "Something went wrong.")}
        </p>
      ) : null}
    </div>
  );
}
