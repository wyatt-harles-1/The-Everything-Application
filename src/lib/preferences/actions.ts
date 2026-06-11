// Server Action for persisting appearance preferences. Two writes:
//   1. The `lh_prefs` cookie (always) — the FOUC-free mirror the root layout
//      reads on the next render.
//   2. shared.user_preferences in the DB (best-effort) — cross-device store.
//
// The DB write is wrapped in try/catch so theming works fully even before the
// migration is applied (cookie-only) or when signed out. The client also
// mutates document.documentElement immediately, so the UI flips instantly and
// this action just makes it durable.

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";

import {
  PREFS_COOKIE,
  PREFS_COOKIE_MAX_AGE,
  parsePrefsCookie,
  stringifyPrefsCookie,
} from "./cookie";
import { preferencesPatchSchema, type Preferences } from "./schema";

export async function updatePreferences(
  patch: unknown,
): Promise<{ ok: boolean }> {
  const parsed = preferencesPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false };

  const store = await cookies();
  const current = parsePrefsCookie(store.get(PREFS_COOKIE)?.value);
  const next: Preferences = { ...current, ...parsed.data };

  // 1. Cookie mirror — non-sensitive, server-readable on the next layout pass.
  store.set(PREFS_COOKIE, stringifyPrefsCookie(next), {
    path: "/",
    maxAge: PREFS_COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  // 2. Durable per-user row. Best-effort: the column subset is exactly the
  // appearance fields, so an existing home_layout is preserved on update.
  try {
    const ctx = await getUserContext();
    if (ctx) {
      await ctx.supabase
        .schema("shared")
        .from("user_preferences")
        .upsert({ user_id: ctx.userId, ...next }, { onConflict: "user_id" });
    }
  } catch {
    // Table may not exist yet (migration deferred) — the cookie is enough.
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
