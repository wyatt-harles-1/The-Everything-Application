"use server";

// Server actions for the integrations hub. syncStrava pulls activities on
// demand (the Wave 1 sync mechanism — no cron/webhooks yet) and disconnectStrava
// revokes + deactivates the source. Both run under the user's RLS-scoped
// client via getUserContext(), so every insert is automatically user-scoped.

import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";
import { recordEvent } from "@/lib/db/events";
import {
  getStravaSource,
  ensureFreshAccessToken,
  updateSourceConfig,
  setSourceInactive,
  getOuraSource,
  ensureFreshOuraToken,
} from "@/lib/integrations/sources";
import {
  listActivities,
  mapActivity,
  deauthorize,
  StravaError,
} from "@/lib/integrations/strava";
import {
  listSleep,
  listReadiness,
  mapSleep,
  mapReadiness,
  OuraError,
} from "@/lib/integrations/oura";

export type SyncResult = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  message?: string;
};

const MS_PER_DAY = 86_400_000;
// Re-fetch a little before last_synced_at so an activity saved right around
// the previous sync can't slip through the cracks. The idempotency index
// makes the overlap harmless.
const SYNC_OVERLAP_MS = 60 * 60 * 1000;

export async function syncStrava(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getStravaSource(ctx.supabase);
  if (!source) return { ok: false, message: "Strava is not connected." };

  let imported = 0;
  let skipped = 0;
  let detailErrors = 0;

  try {
    const { accessToken, config } = await ensureFreshAccessToken(
      ctx.supabase,
      source,
    );

    // First sync reaches back `backfill_days`; later syncs pick up where the
    // last one left off (minus the overlap).
    const afterMs = config.last_synced_at
      ? Date.parse(config.last_synced_at) - SYNC_OVERLAP_MS
      : Date.now() - config.backfill_days * MS_PER_DAY;
    const afterEpoch = Math.floor(afterMs / 1000);

    const activities = await listActivities(accessToken, afterEpoch);

    for (const activity of activities) {
      const m = mapActivity(activity);
      if (!m) continue; // no start time — can't place on the timeline

      // Idempotency guard (mirrors the partial unique index): already imported?
      const { data: existing } = await ctx.supabase
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

      // Parent workout (source_id = the Strava source, so the timeline can
      // distinguish "Run — Strava" from "Run — Manual").
      const { data: workout, error: wErr } = await ctx.supabase
        .schema("wellness")
        .from("workouts")
        .insert({
          user_id: ctx.userId,
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
        // Most likely a unique-index race with a concurrent sync — treat as
        // already-imported rather than failing the whole run.
        skipped++;
        continue;
      }

      // Cardio detail row for distance-based kinds. Shoe attribution is left
      // null on imports so it doesn't pollute shoe mileage with a wrong guess.
      if (m.isCardio) {
        const { error: cErr } = await ctx.supabase
          .schema("wellness")
          .from("cardio_sessions")
          .insert({
            user_id: ctx.userId,
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

      // Universal timeline row.
      const durationMinutes =
        m.durationSeconds != null ? Math.round(m.durationSeconds / 60) : null;
      await recordEvent(ctx.supabase, {
        userId: ctx.userId,
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

    // Stamp the sync time so the next run is incremental.
    await updateSourceConfig(ctx.supabase, source.id, {
      ...config,
      last_synced_at: new Date().toISOString(),
    });

    revalidatePath("/integrations");
    revalidatePath("/running");
    revalidatePath("/");

    const message =
      detailErrors > 0
        ? `Imported ${imported}, skipped ${skipped}. ${detailErrors} activity detail(s) didn't save fully.`
        : undefined;
    return { ok: true, imported, skipped, message };
  } catch (e) {
    const message =
      e instanceof StravaError
        ? `${e.message}${e.detail ? ` (${e.detail})` : ""}`
        : e instanceof Error
          ? e.message
          : "Sync failed.";
    return { ok: false, imported, skipped, message };
  }
}

export async function disconnectStrava(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getStravaSource(ctx.supabase);
  if (!source) return { ok: true }; // already disconnected

  // Best-effort revoke at Strava; proceed to local disconnect regardless.
  try {
    const { accessToken } = await ensureFreshAccessToken(ctx.supabase, source);
    await deauthorize(accessToken);
  } catch {
    // ignore — we still deactivate locally below
  }

  await setSourceInactive(ctx.supabase, source.id);
  revalidatePath("/integrations");
  return { ok: true };
}

// ---- Oura ------------------------------------------------------------------

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function syncOura(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getOuraSource(ctx.supabase);
  if (!source) return { ok: false, message: "Oura is not connected." };

  let imported = 0;
  let skipped = 0;

  try {
    const { accessToken, config } = await ensureFreshOuraToken(
      ctx.supabase,
      source,
    );

    // Oura routes take YYYY-MM-DD. First sync backfills; later syncs resume
    // from last_synced_at minus a 2-day overlap (idempotency dedups it).
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
      const { data: existing } = await ctx.supabase
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
      const { data: row, error } = await ctx.supabase
        .schema("wellness")
        .from("sleep_sessions")
        .insert({
          user_id: ctx.userId,
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
      await recordEvent(ctx.supabase, {
        userId: ctx.userId,
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
      const { data: existing } = await ctx.supabase
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
      const { data: row, error } = await ctx.supabase
        .schema("wellness")
        .from("readiness")
        .insert({
          user_id: ctx.userId,
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
      await recordEvent(ctx.supabase, {
        userId: ctx.userId,
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

    await updateSourceConfig(ctx.supabase, source.id, {
      ...config,
      last_synced_at: new Date().toISOString(),
    });

    revalidatePath("/integrations");
    revalidatePath("/health");
    revalidatePath("/");
    return { ok: true, imported, skipped };
  } catch (e) {
    const message =
      e instanceof OuraError
        ? `${e.message}${e.detail ? ` (${e.detail})` : ""}`
        : e instanceof Error
          ? e.message
          : "Sync failed.";
    return { ok: false, imported, skipped, message };
  }
}

export async function disconnectOura(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getOuraSource(ctx.supabase);
  if (!source) return { ok: true };

  // Oura has no documented public token-revoke endpoint, so this is a local
  // disconnect only: deactivate the source (history stays).
  await setSourceInactive(ctx.supabase, source.id);
  revalidatePath("/integrations");
  return { ok: true };
}
