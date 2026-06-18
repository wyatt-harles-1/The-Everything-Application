// Server-only helper for reading the user's preferences out of the cookie.
// Used by the root layout to set the <html> theme attributes before paint.
// (DB is the cross-device source of truth, but the cookie is the fast,
// always-available mirror; the appearance action keeps them in sync.)

import "server-only";

import { cookies } from "next/headers";

import { parsePrefsCookie, PREFS_COOKIE } from "./cookie";
import type { Preferences } from "./schema";

export async function readPreferences(): Promise<Preferences> {
  const store = await cookies();
  return parsePrefsCookie(store.get(PREFS_COOKIE)?.value);
}
