// Server-side Supabase client — for Server Components, Route Handlers, and
// Server Actions in the App Router.
//
// Unlike the browser client, this one wires Supabase's session cookies into
// Next.js's cookie store. That's how the server knows which user is signed in
// for any given request — without it, every server-side query would behave as
// the anonymous user.
//
// IMPORTANT (Next 15): `cookies()` is async in Next 15, so this factory is
// async too. Always `await createClient()`.

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Supabase reads existing auth cookies via getAll().
        getAll() {
          return cookieStore.getAll();
        },
        // ...and refreshes them via setAll() when tokens rotate.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `cookieStore.set` throws when called from a pure Server Component
            // (cookies can only be written from a Route Handler, Server Action,
            // or middleware). That's fine here — if a Server Component triggers
            // a token refresh, middleware will pick it up on the next request.
          }
        },
      },
    },
  );
}
