// Pure (de)serialization for the `lh_prefs` cookie that mirrors the user's
// theme/accent/density. Kept free of next/headers so it can be imported from
// anywhere; the actual cookies() read/write lives in server.ts + actions.ts.

import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  type Preferences,
} from "./schema";

export const PREFS_COOKIE = "lh_prefs";
// ~1 year. The cookie is a non-sensitive UI mirror; the DB is the real store.
export const PREFS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Parse the raw cookie value into a complete Preferences object, falling back
// to defaults for anything missing or invalid (never throws).
export function parsePrefsCookie(raw: string | undefined | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = preferencesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function stringifyPrefsCookie(prefs: Preferences): string {
  return JSON.stringify(prefs);
}

// The <html> attributes that drive theming. `theme: "system"` is left as the
// literal "system" on data-theme-pref and resolved to light/dark by a tiny
// pre-paint script (see RootLayout); data-theme carries a best-guess so there's
// always a concrete value for the no-JS case.
export function htmlThemeAttrs(prefs: Preferences): {
  "data-theme": string;
  "data-theme-pref": string;
  "data-accent": string;
  "data-density": string;
} {
  return {
    // For "system" we default the SSR value to "light"; the inline script
    // upgrades it to "dark" pre-paint when the OS prefers dark.
    "data-theme": prefs.theme === "system" ? "light" : prefs.theme,
    "data-theme-pref": prefs.theme,
    "data-accent": prefs.accent,
    "data-density": prefs.density,
  };
}
