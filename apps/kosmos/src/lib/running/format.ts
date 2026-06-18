// Running-specific formatting helpers. Storage is metric (meters /
// seconds); display is US (miles / mm:ss/mi). Single source of truth
// so every running surface uses the same units.

const METERS_PER_MILE = 1609.344;

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

export function milesToMeters(mi: number): number {
  return mi * METERS_PER_MILE;
}

// "5.42 mi" / "12.0 mi"
export function formatMiles(meters: number | null | undefined): string {
  if (meters == null) return "—";
  const mi = metersToMiles(meters);
  // Single decimal for >=10 mi, two for shorter runs.
  return `${mi.toFixed(mi >= 10 ? 1 : 2)} mi`;
}

// "47:12" / "1:23:45"
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

// "8:42/mi". Returns "—" when distance or duration missing or zero.
export function formatPace(
  durationSeconds: number | null | undefined,
  distanceMeters: number | null | undefined,
): string {
  if (
    durationSeconds == null ||
    distanceMeters == null ||
    distanceMeters <= 0
  ) {
    return "—";
  }
  const miles = metersToMiles(distanceMeters);
  if (miles <= 0) return "—";
  const secPerMile = durationSeconds / miles;
  const m = Math.floor(secPerMile / 60);
  const sec = Math.round(secPerMile % 60);
  return `${m}:${String(sec).padStart(2, "0")}/mi`;
}
