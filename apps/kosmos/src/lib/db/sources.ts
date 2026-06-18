// Loaders for shared.sources. The only one Wave 1 needs is the user's
// "Manual" source - the auto-created row from the handle_new_user trigger
// in the Phase 1 migration. Every manual log entry uses it as source_id.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getManualSourceId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  // The Manual source is identified by (user_id, provider IS NULL,
  // external_account_id IS NULL) - the same NULLS-NOT-DISTINCT uniqueness
  // constraint that keeps users to one Manual source.
  const { data } = await supabase
    .schema("shared")
    .from("sources")
    .select("id")
    .eq("user_id", userId)
    .is("provider", null)
    .is("external_account_id", null)
    .maybeSingle();

  return data?.id ?? null;
}
