// Appearance settings: theme, accent color, and density. The current values
// come from the cookie (the same source the root layout reads), so the page
// reflects the live state; the controls write through to the cookie + DB.

import { readPreferences } from "@/lib/preferences/server";

import { AppearanceControls } from "./AppearanceControls";

export default async function AppearancePage() {
  const prefs = await readPreferences();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Appearance
        </h1>
        <p className="text-sm text-muted">
          Theme, accent color, and density. Saved to your account and applied
          everywhere.
        </p>
      </header>

      <AppearanceControls initial={prefs} />
    </div>
  );
}
