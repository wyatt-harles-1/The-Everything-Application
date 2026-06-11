// Offline fallback shown by the service worker when a navigation fails with no
// network. Lives outside the (app) auth group so it needs no session. Uses
// theme tokens so it matches the user's chosen theme.

export const metadata = { title: "Offline · Kosmos" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-bg p-8 text-center">
      <h1 className="text-lg font-semibold text-text">You&rsquo;re offline</h1>
      <p className="max-w-xs text-sm text-muted">
        Kosmos needs a connection to load your data. Reconnect and try again.
      </p>
    </div>
  );
}
