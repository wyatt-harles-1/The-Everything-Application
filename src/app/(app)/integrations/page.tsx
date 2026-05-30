// /integrations — connected third-party services. Phase 5 Wave 1 ships the
// Strava card (connect + manual sync). Future integrations (Cronometer,
// Apple Health) will add more cards here.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getStravaSource, getImportedCount } from "@/lib/integrations/sources";
import { isStravaConfigured } from "@/lib/integrations/strava";
import { StravaCard } from "./StravaCard";

// Maps the ?error= / ?connected= flags the OAuth routes redirect back with
// into a human banner.
const NOTICES: Record<string, { ok: boolean; text: string }> = {
  "connected:strava": { ok: true, text: "Strava connected." },
  "error:denied": { ok: false, text: "Strava authorization was cancelled." },
  "error:state": {
    ok: false,
    text: "Authorization expired or failed a security check. Please try again.",
  },
  "error:save_failed": {
    ok: false,
    text: "Couldn't save the Strava connection. Please try again.",
  },
  "error:exchange_failed": {
    ok: false,
    text: "Strava rejected the connection. Check that your Strava app's Authorization Callback Domain matches this site.",
  },
  "error:not_configured": {
    ok: false,
    text: "Strava isn't configured on the server yet (missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET).",
  },
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const source = await getStravaSource(supabase);
  const importedCount = source
    ? await getImportedCount(supabase, source.id)
    : 0;

  const noticeKey = sp.connected
    ? `connected:${sp.connected}`
    : sp.error
      ? `error:${sp.error}`
      : null;
  const notice = noticeKey ? NOTICES[noticeKey] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-2">
      <div>
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Home
        </Link>
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Connect external services to sync data into your timeline.
        </p>
      </div>

      {notice ? (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            notice.ok
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
              : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <StravaCard
        connected={!!source}
        configured={isStravaConfigured()}
        athleteId={source?.config.athlete_id ?? null}
        lastSynced={source?.config.last_synced_at ?? null}
        importedCount={importedCount}
      />
    </div>
  );
}
