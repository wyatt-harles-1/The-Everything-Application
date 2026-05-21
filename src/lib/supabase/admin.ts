// Privileged Supabase client — service_role key, bypasses Row Level Security.
//
// Use this ONLY for server-side operations that genuinely need to act as the
// database superuser: scheduled jobs, admin-only routes, ingesting webhook
// payloads from third-party integrations, or system-level queries that don't
// belong to any single user (like the health check).
//
// NEVER import this file from a Client Component. The `import "server-only"`
// directive below is a guardrail: Next.js will throw a build error if this
// module is ever pulled into a client bundle, which would leak the service
// role key to every visitor of the site.

import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail loudly at call time if env vars aren't set. This is intentional —
  // a silent fallback (e.g. using the anon key) would mask configuration bugs
  // and could give the wrong impression that admin operations are working.
  if (!url) {
    throw new Error(
      "createAdminClient(): NEXT_PUBLIC_SUPABASE_URL is not set. " +
        "Check your .env.local file.",
    );
  }
  if (!serviceKey) {
    throw new Error(
      "createAdminClient(): SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Find it in Supabase Dashboard → Project Settings → API, " +
        "and add it to .env.local (server-only, never exposed to the client).",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      // service_role calls aren't on behalf of a user — disable session features
      // so the client doesn't try to refresh tokens or persist auth state.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
