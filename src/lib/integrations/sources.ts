// Integration source helpers for Phase 5 (Strava first). A "source" row in
// shared.sources represents one connected third-party account. Its `config`
// JSONB stores the OAuth tokens (encrypted) plus sync bookkeeping.
//
// This module orchestrates the three concerns the strava.ts HTTP client
// deliberately doesn't touch: the database (shared.sources), AES encryption
// of tokens (../ai/encryption), and the access-token freshness/refresh dance.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptApiKey, decryptApiKey } from "@/lib/ai/encryption";
import {
  refreshAccessToken,
  type StravaTokenResponse,
} from "./strava";
import {
  refreshAccessToken as refreshOuraToken,
  type OuraTokens,
} from "./oura";

// What we persist in shared.sources.config for a Strava source. access_token
// and refresh_token are AES-GCM blobs (never plaintext at rest); everything
// else is plaintext metadata.
export type StravaConfig = {
  access_token: string; // encrypted
  refresh_token: string; // encrypted
  expires_at: number; // epoch seconds (when the access token dies)
  athlete_id: number;
  scopes: string[];
  last_synced_at: string | null; // ISO; null until the first successful sync
  backfill_days: number; // how far back the first sync reaches
};

export type StravaSource = {
  id: string;
  config: StravaConfig;
};

const DEFAULT_BACKFILL_DAYS = 30;
// Refresh a little before actual expiry so a long sync can't have the token
// die mid-run.
const EXPIRY_BUFFER_SECONDS = 120;

// The active Strava source for the signed-in user, or null if not connected.
export async function getStravaSource(
  supabase: SupabaseClient,
): Promise<StravaSource | null> {
  const { data } = await supabase
    .schema("shared")
    .from("sources")
    .select("id, config")
    .eq("provider", "strava")
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, config: data.config as StravaConfig };
}

// Create or update the Strava source after an OAuth exchange. Reconnecting
// the same athlete upserts on the (user_id, provider, external_account_id)
// unique key and preserves last_synced_at so we don't needlessly re-backfill.
export async function upsertStravaSource(
  supabase: SupabaseClient,
  userId: string,
  token: StravaTokenResponse,
  scopes: string[],
): Promise<{ error: string | null }> {
  const athleteId = token.athlete?.id;
  if (!athleteId) {
    return { error: "Strava did not return an athlete id." };
  }

  // Preserve prior sync bookkeeping on reconnect.
  const { data: existing } = await supabase
    .schema("shared")
    .from("sources")
    .select("config")
    .eq("provider", "strava")
    .eq("external_account_id", String(athleteId))
    .maybeSingle();
  const prior = (existing?.config ?? null) as StravaConfig | null;

  const config: StravaConfig = {
    access_token: encryptApiKey(token.access_token),
    refresh_token: encryptApiKey(token.refresh_token),
    expires_at: token.expires_at,
    athlete_id: athleteId,
    scopes,
    last_synced_at: prior?.last_synced_at ?? null,
    backfill_days: prior?.backfill_days ?? DEFAULT_BACKFILL_DAYS,
  };

  const { error } = await supabase
    .schema("shared")
    .from("sources")
    .upsert(
      {
        user_id: userId,
        name: "Strava",
        kind: "integration",
        domain: "wellness",
        provider: "strava",
        external_account_id: String(athleteId),
        config,
        is_active: true,
      },
      { onConflict: "user_id,provider,external_account_id" },
    );
  return { error: error?.message ?? null };
}

// Persist a full config blob (e.g. after a token refresh or to stamp
// last_synced_at). Accepts any provider's config shape.
export async function updateSourceConfig(
  supabase: SupabaseClient,
  sourceId: string,
  config: StravaConfig | OuraConfig,
): Promise<void> {
  await supabase
    .schema("shared")
    .from("sources")
    .update({ config })
    .eq("id", sourceId);
}

// Soft-disconnect: keep all imported history, just stop treating the source
// as active. The encrypted access/refresh tokens are wiped from `config` so a
// disconnect actually severs access — a leftover refresh-token blob is
// long-lived and could otherwise be resurrected to pull live data after the
// user believes they've disconnected. We read-modify-write the existing config
// so sync bookkeeping (last_synced_at, backfill_days, scopes) survives for any
// later reconnect; only the secrets are stripped.
export async function setSourceInactive(
  supabase: SupabaseClient,
  sourceId: string,
): Promise<void> {
  const { data } = await supabase
    .schema("shared")
    .from("sources")
    .select("config")
    .eq("id", sourceId)
    .maybeSingle();

  // Drop the two secret fields; keep the rest of the bookkeeping. `config` may
  // be a Strava or Oura blob (or null on a malformed row) — both share the
  // access_token / refresh_token keys, so one strip covers both.
  const rest = { ...((data?.config ?? {}) as Record<string, unknown>) };
  delete rest.access_token;
  delete rest.refresh_token;

  await supabase
    .schema("shared")
    .from("sources")
    .update({ is_active: false, config: rest })
    .eq("id", sourceId);
}

// Return a usable plaintext access token, refreshing (and persisting the
// rotated tokens) if the current one is at/near expiry. Returns the possibly
// updated config so the caller keeps working from the latest bookkeeping.
export async function ensureFreshAccessToken(
  supabase: SupabaseClient,
  source: StravaSource,
): Promise<{ accessToken: string; config: StravaConfig }> {
  const cfg = source.config;
  const now = Math.floor(Date.now() / 1000);
  if (cfg.expires_at - EXPIRY_BUFFER_SECONDS > now) {
    return { accessToken: decryptApiKey(cfg.access_token), config: cfg };
  }

  // Expired (or about to): refresh. Strava rotates the refresh token, so we
  // must store the new one back.
  const refreshed = await refreshAccessToken(decryptApiKey(cfg.refresh_token));
  const nextConfig: StravaConfig = {
    ...cfg,
    access_token: encryptApiKey(refreshed.access_token),
    refresh_token: encryptApiKey(refreshed.refresh_token),
    expires_at: refreshed.expires_at,
  };
  await updateSourceConfig(supabase, source.id, nextConfig);
  return { accessToken: refreshed.access_token, config: nextConfig };
}

// Count of activities already imported from this source - shown on the
// integrations card.
export async function getImportedCount(
  supabase: SupabaseClient,
  sourceId: string,
): Promise<number> {
  const { count } = await supabase
    .schema("wellness")
    .from("workouts")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);
  return count ?? 0;
}

// Generic row count for a source in any schema/table - used by integration
// cards that import into more than one table (e.g. Oura → sleep + readiness).
export async function countForSource(
  supabase: SupabaseClient,
  schema: string,
  table: string,
  sourceId: string,
): Promise<number> {
  const { count } = await supabase
    .schema(schema)
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);
  return count ?? 0;
}

// ---- Oura ------------------------------------------------------------------
// Parallel helpers for the Oura source. Strava's helpers are intentionally
// left untouched so the verified prod path can't regress; the shapes are close
// but not identical (Oura has no athlete id, and its token TTL is normalized
// to expires_at in oura.ts).

export type OuraConfig = {
  access_token: string; // encrypted
  refresh_token: string; // encrypted
  expires_at: number; // epoch seconds
  scopes: string[];
  last_synced_at: string | null;
  backfill_days: number;
};

export type OuraSource = {
  id: string;
  config: OuraConfig;
};

export async function getOuraSource(
  supabase: SupabaseClient,
): Promise<OuraSource | null> {
  const { data } = await supabase
    .schema("shared")
    .from("sources")
    .select("id, config")
    .eq("provider", "oura")
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, config: data.config as OuraConfig };
}

// One Oura source per user. external_account_id is null (Oura needs no account
// id), so the (user_id, provider, external_account_id) NULLS-NOT-DISTINCT
// unique key makes reconnect an upsert. Preserves prior sync bookkeeping.
export async function upsertOuraSource(
  supabase: SupabaseClient,
  userId: string,
  token: OuraTokens,
  scopes: string[],
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .schema("shared")
    .from("sources")
    .select("config")
    .eq("provider", "oura")
    .eq("user_id", userId)
    .maybeSingle();
  const prior = (existing?.config ?? null) as OuraConfig | null;

  const config: OuraConfig = {
    access_token: encryptApiKey(token.access_token),
    refresh_token: encryptApiKey(token.refresh_token),
    expires_at: token.expires_at,
    scopes,
    last_synced_at: prior?.last_synced_at ?? null,
    backfill_days: prior?.backfill_days ?? DEFAULT_BACKFILL_DAYS,
  };

  const { error } = await supabase
    .schema("shared")
    .from("sources")
    .upsert(
      {
        user_id: userId,
        name: "Oura",
        kind: "integration",
        domain: "wellness",
        provider: "oura",
        external_account_id: null,
        config,
        is_active: true,
      },
      { onConflict: "user_id,provider,external_account_id" },
    );
  return { error: error?.message ?? null };
}

// Fresh Oura access token, refreshing + persisting rotated tokens near expiry.
export async function ensureFreshOuraToken(
  supabase: SupabaseClient,
  source: OuraSource,
): Promise<{ accessToken: string; config: OuraConfig }> {
  const cfg = source.config;
  const now = Math.floor(Date.now() / 1000);
  if (cfg.expires_at - EXPIRY_BUFFER_SECONDS > now) {
    return { accessToken: decryptApiKey(cfg.access_token), config: cfg };
  }
  const refreshed = await refreshOuraToken(decryptApiKey(cfg.refresh_token));
  const nextConfig: OuraConfig = {
    ...cfg,
    access_token: encryptApiKey(refreshed.access_token),
    refresh_token: encryptApiKey(refreshed.refresh_token),
    expires_at: refreshed.expires_at,
  };
  await updateSourceConfig(supabase, source.id, nextConfig);
  return { accessToken: refreshed.access_token, config: nextConfig };
}

// ---- Cron ------------------------------------------------------------------

export type ActiveIntegrationSource = {
  id: string;
  user_id: string;
  provider: string;
  config: StravaConfig | OuraConfig;
};

// Every active integration source across all users, with explicit user_id.
// Used by the daily cron (admin client, no RLS) — unlike getStravaSource /
// getOuraSource which rely on RLS to scope to the signed-in user.
export async function listActiveIntegrationSources(
  supabase: SupabaseClient,
): Promise<ActiveIntegrationSource[]> {
  const { data } = await supabase
    .schema("shared")
    .from("sources")
    .select("id, user_id, provider, config")
    .eq("kind", "integration")
    .eq("is_active", true);
  return (data ?? []) as ActiveIntegrationSource[];
}
