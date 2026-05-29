// Next.js middleware — runs on every request before the page or route handler.
//
// Its only job here is to refresh Supabase's access token when it has expired.
// Supabase tokens are short-lived (1 hour by default in config.toml); without
// this middleware, server components would read a stale session and the user
// would appear logged out as soon as the token aged out, even though their
// refresh token is still valid.
//
// The `await supabase.auth.getUser()` line below is the load-bearing call —
// the SSR helpers detect an expired access token, exchange the refresh token
// for a fresh one, and the `setAll` cookie callback persists the new tokens
// back to the response. Don't remove the getUser() call, even though we
// don't use its return value here.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Site-wide passcode gate. When SITE_PASSCODE is set (production), every
  // request must carry HTTP Basic credentials whose password matches it —
  // a coarse "only I can reach the site right now" lock that sits in front
  // of the normal Supabase per-user auth. When the env var is unset (e.g.
  // local dev), the gate is skipped entirely. The browser caches the
  // credentials per-domain after the first prompt, so the auth callback and
  // every later request pass through without re-prompting.
  const passcode = process.env.SITE_PASSCODE;
  if (passcode) {
    const header = request.headers.get("authorization");
    let ok = false;
    if (header?.startsWith("Basic ")) {
      try {
        const decoded = atob(header.slice("Basic ".length));
        // Format is "username:password"; we only check the password, so any
        // username works (leave it blank or type anything in the prompt).
        const password = decoded.slice(decoded.indexOf(":") + 1);
        ok = password === passcode;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Life Hub"' },
      });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Cookies on the *request* let downstream getServerSideProps /
          // server components see the refreshed session in this same request.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Rebuild the response so the new request cookies propagate, then
          // also set them on the *response* so the browser persists them.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  // Skip middleware on Next's own static assets and common image extensions —
  // there's no session to refresh on a logo file. Everything else (pages,
  // route handlers, API endpoints) goes through.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
