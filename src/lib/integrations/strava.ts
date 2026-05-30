// Strava API client + activity mappers (Phase 5 Wave 1).
//
// This module is a PURE HTTP client: it talks to Strava's OAuth + REST
// endpoints with plaintext tokens and knows nothing about our database or
// token encryption. Persistence + AES encryption of tokens live in
// ./sources.ts, which orchestrates this client. Keeping the split means
// this file is trivially testable and has no DB coupling.
//
// Strava OAuth2 reference: https://developers.strava.com/docs/authentication/

import "server-only";

import {
  formatMiles,
  formatDuration,
  formatPace,
} from "@/lib/running/format";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";
const API_BASE = "https://www.strava.com/api/v3";

// The wellness.workouts.kind CHECK constraint. Imports map into this union.
export type WorkoutKind =
  | "lifting"
  | "running"
  | "cycling"
  | "swimming"
  | "mobility"
  | "walk"
  | "sport"
  | "other";

// Raised on any non-2xx from Strava so callers can surface a clean message.
export class StravaError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "StravaError";
    this.detail = detail;
  }
}

function requireEnv(name: "STRAVA_CLIENT_ID" | "STRAVA_CLIENT_SECRET"): string {
  const v = process.env[name];
  if (!v) {
    throw new StravaError(
      `${name} is not configured. Set it in the environment to use the Strava integration.`,
    );
  }
  return v;
}

// True iff both Strava app credentials are present. The UI uses this to show
// a setup hint instead of a broken Connect button.
export function isStravaConfigured(): boolean {
  return !!process.env.STRAVA_CLIENT_ID && !!process.env.STRAVA_CLIENT_SECRET;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

// ---- OAuth -----------------------------------------------------------------

// Build the consent URL we redirect the user's browser to. `state` is our
// CSRF nonce, echoed back to the callback. `activity:read_all` lets us read
// the athlete's activities (including ones marked "Only You").
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("STRAVA_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number };
};

// Exchange the one-time auth code for tokens. Strava does not require
// redirect_uri in this call. Returns the athlete on the initial exchange.
export async function exchangeCode(
  code: string,
): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new StravaError(
      `Strava token exchange failed (${res.status}).`,
      await safeText(res),
    );
  }
  return (await res.json()) as StravaTokenResponse;
}

// Trade a refresh token for a fresh access token. Strava ROTATES the refresh
// token on every call, so the caller MUST persist the returned refresh_token.
export async function refreshAccessToken(
  refreshToken: string,
): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new StravaError(
      `Strava token refresh failed (${res.status}).`,
      await safeText(res),
    );
  }
  return (await res.json()) as StravaTokenResponse;
}

// Best-effort revoke when the user disconnects. Never throws - a failed
// deauth shouldn't block us from marking the source inactive locally.
export async function deauthorize(accessToken: string): Promise<void> {
  try {
    await fetch(DEAUTHORIZE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // ignore - local disconnect proceeds regardless
  }
}

// ---- Activities ------------------------------------------------------------

export type StravaActivity = {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  distance?: number; // meters
  moving_time?: number; // seconds
  elapsed_time?: number; // seconds
  start_date?: string; // ISO 8601 UTC
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number; // meters
};

// Page through the athlete's activities created after `afterEpoch` (seconds).
// per_page maxes at 100; we cap the loop at 20 pages (2000 activities) as a
// runaway guard - far more than a single manual sync should ever pull.
export async function listActivities(
  accessToken: string,
  afterEpoch: number,
): Promise<StravaActivity[]> {
  const out: StravaActivity[] = [];
  const perPage = 100;
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      after: String(afterEpoch),
      per_page: String(perPage),
      page: String(page),
    });
    const res = await fetch(`${API_BASE}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new StravaError(
        `Strava activities fetch failed (${res.status}).`,
        await safeText(res),
      );
    }
    const batch = (await res.json()) as StravaActivity[];
    out.push(...batch);
    if (batch.length < perPage) break; // last page
  }
  return out;
}

// Strava sport_type/type -> our workout kind. Anything not listed (e.g.
// WeightTraining, Workout, Yoga) falls through to "other".
const KIND_MAP: Record<string, WorkoutKind> = {
  Run: "running",
  TrailRun: "running",
  VirtualRun: "running",
  Ride: "cycling",
  VirtualRide: "cycling",
  MountainBikeRide: "cycling",
  GravelRide: "cycling",
  EBikeRide: "cycling",
  EMountainBikeRide: "cycling",
  Swim: "swimming",
  Walk: "walk",
  Hike: "walk",
};

export type MappedActivity = {
  externalId: string;
  kind: WorkoutKind;
  // Cardio kinds get a wellness.cardio_sessions detail row; others don't.
  isCardio: boolean;
  title: string;
  startedAt: string; // ISO
  endedAt: string | null; // start + elapsed_time
  distanceMeters: number | null;
  durationSeconds: number | null; // moving time
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainMeters: number | null;
  summary: string;
};

// Translate one Strava activity into the fields our tables expect. Returns
// null only when the activity lacks a start time (can't place it on the
// timeline) - the caller skips those.
export function mapActivity(a: StravaActivity): MappedActivity | null {
  if (!a.start_date) return null;
  const sport = a.sport_type ?? a.type ?? "";
  const kind = KIND_MAP[sport] ?? "other";
  const isCardio =
    kind === "running" ||
    kind === "cycling" ||
    kind === "swimming" ||
    kind === "walk";

  const startMs = Date.parse(a.start_date);
  const elapsed = a.elapsed_time ?? null;
  const endedAt =
    elapsed != null ? new Date(startMs + elapsed * 1000).toISOString() : null;

  const distanceMeters = a.distance != null ? Number(a.distance) : null;
  const durationSeconds = a.moving_time ?? null;

  // Compact one-line summary for the timeline + run list.
  const parts: string[] = [];
  if (distanceMeters != null && distanceMeters > 0) {
    parts.push(formatMiles(distanceMeters));
  }
  if (durationSeconds != null) parts.push(formatDuration(durationSeconds));
  if (kind === "running" || kind === "walk") {
    const pace = formatPace(durationSeconds, distanceMeters);
    if (pace !== "—") parts.push(pace);
  }
  const summary = parts.join(" · ") || sport || "Activity";

  return {
    externalId: String(a.id),
    kind,
    isCardio,
    title: a.name?.trim() || sport || "Strava activity",
    startedAt: new Date(startMs).toISOString(),
    endedAt,
    distanceMeters,
    durationSeconds,
    avgHeartRate: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHeartRate: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    elevationGainMeters:
      a.total_elevation_gain != null ? Number(a.total_elevation_gain) : null,
    summary,
  };
}
