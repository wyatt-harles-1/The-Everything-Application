// GET /api/cron/sync — daily auto-sync for all connected integrations
// (Phase 5b). Invoked by Vercel Cron (see vercel.json). There is no signed-in
// user here, so it runs with the service-role admin client and an explicit
// user_id per source, reusing the same cores as the manual "Sync now" buttons.
//
// Auth: Vercel attaches `Authorization: Bearer <CRON_SECRET>` to scheduled
// invocations when CRON_SECRET is set on the project. We reject anything else,
// so the endpoint isn't publicly triggerable. /api/cron is also exempt from the
// passcode gate in middleware.ts (a cron request carries no gate cookie).

import { createAdminClient } from "@/lib/supabase/admin";
import { listActiveIntegrationSources } from "@/lib/integrations/sources";
import type { StravaSource, OuraSource } from "@/lib/integrations/sources";
import { syncStravaSource, syncOuraSource } from "@/lib/integrations/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized =
    !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const sources = await listActiveIntegrationSources(supabase);

  const results: Array<{
    provider: string;
    imported?: number;
    skipped?: number;
    error?: string;
  }> = [];

  // Sequential keeps us well under rate limits and the function timeout for a
  // personal-scale number of sources; isolate each so one failure (e.g. a
  // revoked token) doesn't abort the rest.
  for (const src of sources) {
    try {
      if (src.provider === "strava") {
        const r = await syncStravaSource(supabase, src.user_id, {
          id: src.id,
          config: src.config,
        } as StravaSource);
        results.push({ provider: "strava", imported: r.imported, skipped: r.skipped });
      } else if (src.provider === "oura") {
        const r = await syncOuraSource(supabase, src.user_id, {
          id: src.id,
          config: src.config,
        } as OuraSource);
        results.push({ provider: "oura", imported: r.imported, skipped: r.skipped });
      }
    } catch (e) {
      results.push({
        provider: src.provider,
        error: e instanceof Error ? e.message : "sync failed",
      });
    }
  }

  return Response.json({ ran: results.length, results });
}
