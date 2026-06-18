// Shared sync cores for the integrations (Phase 5b). These hold the actual
// per-source import logic, parameterized on (supabase, userId, source) so they
// can run from EITHER path:
//   - the user-triggered "Sync now" server actions (RLS client + session), or
//   - the daily cron route (service-role admin client, no session).
//
// They do NOT call getUserContext() or revalidatePath() — those are
// request-scoped concerns the server actions handle. On failure they throw
// (StravaError/OuraError or otherwise); callers decide how to surface it.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { recordEvent } from "@/lib/db/events";
import {
  ensureFreshAccessToken,
  ensureFreshOuraToken,
  updateSourceConfig,
  type StravaSource,
  type OuraSource,
} from "./sources";
import { listActivities, mapActivity } from "./strava";
import { listSleep, listReadiness, mapSleep, mapReadiness } from "./oura";

const MS_PER_DAY = 86_400_000;
// Re-fetch a little before last_synced_at so an item saved right around the
// previous sync can't slip through. The idempotency indexes make it harmless.
const SYNC_OVERLAP_MS = 60 * 60 * 1000;

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// ---- Strava ----------------------------------------------------------------

export async function syncStravaSource(
  supabase: SupabaseClient,
  userId: string,
  source: StravaSource,
): Promise<{ imported: number; skipped: number; detailErrors: number }> {
  let imported = 0;
  let skipped = 0;
  let detailErrors = 0;

  const { accessToken, config } = await ensureFreshAccessToken(
    supabase,
    source,
  );

  // First sync reaches back `backfill_days`; later syncs resume from
  // last_synced_at minus the overlap.
  const afterMs = config.last_synced_at
    ? Date.parse(config.last_synced_at) - SYNC_OVERLAP_MS
    : Date.now() - config.backfill_days * MS_PER_DAY;
  const afterEpoch = Math.floor(afterMs / 1000);

  const activities = await listActivities(accessToken, afterEpoch);

  for (const activity of activities) {
    const m = mapActivity(activity);
    if (!m) continue; // no start time — can't place on the timeline

    const { data: existing } = await supabase
      .schema("wellness")
      .from("workouts")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_id", m.externalId)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const { data: workout, error: wErr } = await supabase
      .schema("wellness")
      .from("workouts")
      .insert({
        user_id: userId,
        source_id: source.id,
        external_id: m.externalId,
        started_at: m.startedAt,
        ended_at: m.endedAt,
        kind: m.kind,
        title: m.title,
      })
      .select("id")
      .single();
    if (wErr || !workout) {
      // Likely a unique-index race — treat as already-imported.
      skipped++;
      continue;
    }

    if (m.isCardio) {
      const { error: cErr } = await supabase
        .schema("wellness")
        .from("cardio_sessions")
        .insert({
          user_id: userId,
          source_id: source.id,
          workout_id: workout.id,
          distance_meters: m.distanceMeters,
          duration_seconds: m.durationSeconds,
          avg_heart_rate: m.avgHeartRate,
          max_heart_rate: m.maxHeartRate,
          elevation_gain_meters: m.elevationGainMeters,
        });
      if (cErr) detailErrors++;
    }

    const durationMinutes =
      m.durationSeconds != null ? Math.round(m.durationSeconds / 60) : null;
    await recordEvent(supabase, {
      userId,
      sourceId: source.id,
      domain: "wellness",
      eventType: "workout",
      occurredAt: m.startedAt,
      durationMinutes,
      detailTable: "wellness.workouts",
      detailId: workout.id,
      title: m.title,
      summary: m.summary,
    });
    imported++;
  }

  await updateSourceConfig(supabase, source.id, {
    ...config,
    last_synced_at: new Date().toISOString(),
  });

  return { imported, skipped, detailErrors };
}

// ---- Oura ------------------------------------------------------------------

export async function syncOuraSource(
  supabase: SupabaseClient,
  userId: string,
  source: OuraSource,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;

  const { accessToken, config } = await ensureFreshOuraToken(supabase, source);

  // Oura routes take YYYY-MM-DD. First sync backfills; later syncs resume from
  // last_synced_at minus a 2-day overlap.
  const startMs = config.last_synced_at
    ? Date.parse(config.last_synced_at) - 2 * MS_PER_DAY
    : Date.now() - config.backfill_days * MS_PER_DAY;
  const startDate = ymd(startMs);
  const endDate = ymd(Date.now());

  const [sleeps, readiness] = await Promise.all([
    listSleep(accessToken, startDate, endDate),
    listReadiness(accessToken, startDate, endDate),
  ]);

  // Map sleep first; index HRV/resting-HR by day so readiness can borrow them.
  const mappedSleeps = sleeps
    .map(mapSleep)
    .filter((s): s is NonNullable<typeof s> => s !== null);
  const sleepByDay: Record<
    string,
    { hrvAvg: number | null; restingHr: number | null }
  > = {};
  for (const m of mappedSleeps) {
    sleepByDay[m.day] = { hrvAvg: m.hrvAvg, restingHr: m.restingHr };
  }

  // Sleep → wellness.sleep_sessions
  for (const m of mappedSleeps) {
    const { data: existing } = await supabase
      .schema("wellness")
      .from("sleep_sessions")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_id", m.externalId)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }
    const { data: row, error } = await supabase
      .schema("wellness")
      .from("sleep_sessions")
      .insert({
        user_id: userId,
        source_id: source.id,
        external_id: m.externalId,
        start_at: m.startAt,
        end_at: m.endAt,
        quality: m.quality,
        interruptions: m.interruptions,
        notes: m.notes,
      })
      .select("id")
      .single();
    if (error || !row) {
      skipped++;
      continue;
    }
    const mins = Math.max(
      0,
      Math.round((Date.parse(m.endAt) - Date.parse(m.startAt)) / 60000),
    );
    await recordEvent(supabase, {
      userId,
      sourceId: source.id,
      domain: "wellness",
      eventType: "sleep",
      occurredAt: m.startAt,
      durationMinutes: mins,
      detailTable: "wellness.sleep_sessions",
      detailId: row.id,
      title: "Sleep",
      summary: m.notes,
    });
    imported++;
  }

  // Readiness → wellness.readiness
  for (const rec of readiness) {
    const m = mapReadiness(rec, sleepByDay);
    if (!m) continue;
    const { data: existing } = await supabase
      .schema("wellness")
      .from("readiness")
      .select("id")
      .eq("source_id", source.id)
      .eq("external_id", m.externalId)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }
    const { data: row, error } = await supabase
      .schema("wellness")
      .from("readiness")
      .insert({
        user_id: userId,
        source_id: source.id,
        external_id: m.externalId,
        day: m.day,
        score: m.score,
        hrv_avg: m.hrvAvg,
        resting_hr: m.restingHr,
        temp_deviation: m.tempDeviation,
      })
      .select("id")
      .single();
    if (error || !row) {
      skipped++;
      continue;
    }
    await recordEvent(supabase, {
      userId,
      sourceId: source.id,
      domain: "wellness",
      eventType: "readiness",
      occurredAt: m.occurredAt,
      detailTable: "wellness.readiness",
      detailId: row.id,
      title: "Readiness",
      summary: m.summary,
    });
    imported++;
  }

  await updateSourceConfig(supabase, source.id, {
    ...config,
    last_synced_at: new Date().toISOString(),
  });

  return { imported, skipped };
}
