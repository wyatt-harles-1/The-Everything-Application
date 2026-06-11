// Boilerplate Server Actions need on every call: get the supabase server
// client, get the signed-in user, and resolve the user's Manual source id.
// Returns null if anything is missing; callers convert that into a banner
// error string for the form.

import "server-only";

import { createClient } from "@/lib/supabase/server";

import { getManualSourceId } from "./sources";

export async function getUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sourceId = await getManualSourceId(supabase, user.id);
  if (!sourceId) return null;

  return { supabase, userId: user.id, email: user.email ?? null, sourceId };
}

export type FormActionState =
  | { ok: true }
  | {
      ok: false;
      banner?: string;
      errors?: Record<string, string[] | undefined>;
      // What the user just submitted - the form re-hydrates these as
      // defaultValues so they don't have to retype after a validation fail.
      // Only scalar fields; arrays managed via useState (lifting_sets,
      // bloodwork_results) preserve themselves.
      values?: Record<string, string>;
    }
  | null;

// Snapshot the scalar fields of a FormData into a plain object suitable for
// re-hydrating <input defaultValue={...} /> on the next render. File entries
// are skipped (browsers can't programmatically restore file inputs anyway).
export function captureValues(fd: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}
