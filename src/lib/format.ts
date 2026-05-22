// Tiny formatting helpers shared across pages.

// Format an ISO timestamp into "YYYY-MM-DDTHH:mm" that a native
// <input type="datetime-local"> expects. Uses UTC fields so server-render
// and client-render produce the same string (avoids hydration mismatch).
// Tradeoff: the displayed default shows UTC clock time, which can be off by
// the user's timezone. Phase 2 accepts that - precise timezone-aware UX
// is a later polish.
export function toDateTimeLocalUTC(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// Friendly human display - used in detail pages and the timeline list.
// Renders local-time on the client side. We only call this from Server
// Components that pass the string to the client, OR we accept that the
// initial server render uses UTC; for log lists this is fine since the
// timeline is approximate.
export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

// "8h 12m" / "1h 5m" / "23m" - for showing a duration computed from two
// timestamps without dragging in a date library.
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
