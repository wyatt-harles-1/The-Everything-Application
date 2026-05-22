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

  return { supabase, userId: user.id, sourceId };
}

export type FormActionState =
  | { ok: true }
  | { ok: false; banner?: string; errors?: Record<string, string[] | undefined> }
  | null;
