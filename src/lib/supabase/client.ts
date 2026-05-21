// Browser Supabase client — for use in Client Components only.
//
// This client uses the public "anon" key, which is safe to ship to the browser.
// All access through this client is gated by Postgres Row Level Security (RLS)
// policies, so the anon key on its own cannot read or modify data unless an
// RLS policy explicitly permits it for the signed-in user.
//
// Use this in any file marked "use client". For server components, route
// handlers, and server actions, use `./server.ts` instead so cookies (and
// therefore the signed-in session) are read correctly on the server.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // The `!` non-null assertion is safe here because:
  //   - These are NEXT_PUBLIC_ vars, so Next.js inlines them at build time.
  //   - If they were missing, the dev server / build would surface a clear
  //     error long before this code runs.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
