// Oura Cloud API v2 client + mappers (Phase 5c).
//
// Same shape as strava.ts (pure HTTP, plaintext tokens, no DB/encryption) with
// two Oura-specific differences worth calling out:
//   1. Token requests are FORM-ENCODED (application/x-www-form-urlencoded),
//      not JSON like Strava.
//   2. The token response carries `expires_in` (relative seconds); we normalize
//      to an absolute `expires_at` epoch so the rest of the code matches Strava.
//
// Docs: https://cloud.ouraring.com/v2/docs

import "server-only";

const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const API_BASE = "https://api.ouraring.com/v2/usercollection";

export class OuraError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "OuraError";
    this.detail = detail;
  }
}

function requireEnv(name: "OURA_CLIENT_ID" | "OURA_CLIENT_SECRET"): string {
  const v = process.env[name];
  if (!v) {
    throw new OuraError(
      `${name} is not configured. Set it in the environment to use the Oura integration.`,
    );
  }
  return v;
}

export function isOuraConfigured(): boolean {
  return !!process.env.OURA_CLIENT_ID && !!process.env.OURA_CLIENT_SECRET;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

// ---- OAuth -----------------------------------------------------------------

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("OURA_CLIENT_ID"),
    redirect_uri: redirectUri,
    scope: "daily personal", // `daily` covers the sleep + readiness routes
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// Normalized token shape the source layer persists (absolute expiry).
export type OuraTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
};

type OuraTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds from now
  token_type: string;
};

function normalize(json: OuraTokenResponse): OuraTokens {
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 0),
  };
}

async function tokenRequest(body: URLSearchParams): Promise<OuraTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new OuraError(
      `Oura token request failed (${res.status}).`,
      await safeText(res),
    );
  }
  return normalize((await res.json()) as OuraTokenResponse);
}

// Oura requires redirect_uri on the auth-code exchange and it must match the
// one used to authorize.
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<OuraTokens> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: requireEnv("OURA_CLIENT_ID"),
      client_secret: requireEnv("OURA_CLIENT_SECRET"),
    }),
  );
}

// Oura rotates the refresh token on every refresh, so the caller must persist
// the returned refresh_token.
export async function refreshAccessToken(
  refreshToken: string,
): Promise<OuraTokens> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: requireEnv("OURA_CLIENT_ID"),
      client_secret: requireEnv("OURA_CLIENT_SECRET"),
    }),
  );
}

// ---- Data fetch ------------------------------------------------------------

type OuraPage<T> = { data: T[]; next_token?: string | null };

// Generic paginated GET over a usercollection route. Dates are YYYY-MM-DD.
async function fetchAll<T>(
  path: string,
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<T[]> {
  const out: T[] = [];
  let nextToken: string | null = null;
  for (let i = 0; i < 30; i++) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    if (nextToken) params.set("next_token", nextToken);
    const res = await fetch(`${API_BASE}/${path}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new OuraError(
        `Oura ${path} fetch failed (${res.status}).`,
        await safeText(res),
      );
    }
    const page = (await res.json()) as OuraPage<T>;
    out.push(...(page.data ?? []));
    nextToken = page.next_token ?? null;
    if (!nextToken) break;
  }
  return out;
}

type OuraSleep = {
  id?: string;
  day: string;
  type?: string;
  bedtime_start?: string;
  bedtime_end?: string;
  total_sleep_duration?: number; // seconds asleep
  efficiency?: number; // 0-100
  restless_periods?: number;
  average_hrv?: number; // ms
  lowest_heart_rate?: number; // bpm
};

type OuraReadiness = {
  id?: string;
  day: string;
  score?: number; // 0-100
  temperature_deviation?: number; // °C
  timestamp?: string;
};

export async function listSleep(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<OuraSleep[]> {
  return fetchAll<OuraSleep>("sleep", accessToken, startDate, endDate);
}

export async function listReadiness(
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<OuraReadiness[]> {
  return fetchAll<OuraReadiness>(
    "daily_readiness",
    accessToken,
    startDate,
    endDate,
  );
}

// ---- Mappers ---------------------------------------------------------------

export type MappedSleep = {
  externalId: string;
  day: string;
  startAt: string;
  endAt: string;
  quality: number | null; // 1-10
  interruptions: number | null;
  notes: string;
  // Borrowed by readiness for the same day.
  hrvAvg: number | null;
  restingHr: number | null;
};

// Main nightly sleep only (type long_sleep); naps are skipped in this wave.
export function mapSleep(rec: OuraSleep): MappedSleep | null {
  if (rec.type && rec.type !== "long_sleep") return null;
  if (!rec.bedtime_start || !rec.bedtime_end) return null;

  const quality =
    rec.efficiency != null
      ? Math.min(10, Math.max(1, Math.round(rec.efficiency / 10)))
      : null;

  const parts: string[] = [];
  if (rec.total_sleep_duration != null) {
    const h = Math.floor(rec.total_sleep_duration / 3600);
    const m = Math.round((rec.total_sleep_duration % 3600) / 60);
    parts.push(`${h}h ${m}m asleep`);
  }
  if (rec.efficiency != null) parts.push(`eff ${rec.efficiency}%`);
  if (rec.average_hrv != null) parts.push(`HRV ${rec.average_hrv}`);
  if (rec.lowest_heart_rate != null) parts.push(`RHR ${rec.lowest_heart_rate}`);

  return {
    externalId: rec.id ?? `${rec.day}:${rec.bedtime_start}`,
    day: rec.day,
    startAt: new Date(rec.bedtime_start).toISOString(),
    endAt: new Date(rec.bedtime_end).toISOString(),
    quality,
    interruptions: rec.restless_periods ?? null,
    notes: parts.length ? `Oura: ${parts.join(" · ")}` : "Oura sync",
    hrvAvg: rec.average_hrv ?? null,
    restingHr: rec.lowest_heart_rate ?? null,
  };
}

export type MappedReadiness = {
  externalId: string;
  day: string;
  score: number | null;
  tempDeviation: number | null;
  hrvAvg: number | null;
  restingHr: number | null;
  occurredAt: string;
  summary: string;
};

// readiness score + temp come from daily_readiness; HRV/RHR are borrowed from
// the same day's main sleep (Oura only exposes raw HRV/HR on the sleep doc).
export function mapReadiness(
  rec: OuraReadiness,
  sleepByDay: Record<string, { hrvAvg: number | null; restingHr: number | null }>,
): MappedReadiness | null {
  if (!rec.day) return null;
  const sleep = sleepByDay[rec.day];
  const hrvAvg = sleep?.hrvAvg ?? null;
  const restingHr = sleep?.restingHr ?? null;

  const parts: string[] = [];
  if (rec.score != null) parts.push(`readiness ${rec.score}`);
  if (hrvAvg != null) parts.push(`HRV ${hrvAvg}`);
  if (restingHr != null) parts.push(`RHR ${restingHr}`);

  return {
    externalId: rec.id ?? `readiness:${rec.day}`,
    day: rec.day,
    score: rec.score ?? null,
    tempDeviation: rec.temperature_deviation ?? null,
    hrvAvg,
    restingHr,
    occurredAt: rec.timestamp
      ? new Date(rec.timestamp).toISOString()
      : new Date(`${rec.day}T12:00:00Z`).toISOString(),
    summary: parts.join(" · ") || "Readiness",
  };
}
