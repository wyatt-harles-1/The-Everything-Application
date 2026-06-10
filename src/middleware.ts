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

import { GATE_COOKIE, sha256Hex } from "@/lib/gate";

export async function middleware(request: NextRequest) {
  // Site-wide passcode gate. When SITE_PASSCODE is set (production), the
  // user must submit the passcode at /gate, which sets a cookie carrying a
  // SHA-256 hash of the passcode. Here we just compare the cookie's hash
  // against a fresh hash of the env var and redirect to /gate on mismatch.
  // /gate itself is excluded so the form is reachable. Unset env var (e.g.
  // local dev) skips the gate entirely.
  const passcode = process.env.SITE_PASSCODE;
  if (
    passcode &&
    request.nextUrl.pathname !== "/gate" &&
    // Cron jobs (Vercel) carry no gate cookie; they auth via CRON_SECRET in
    // the route itself, so don't bounce them to /gate.
    !request.nextUrl.pathname.startsWith("/api/cron")
  ) {
    const cookieHash = request.cookies.get(GATE_COOKIE)?.value;
    const expected = await sha256Hex(passcode);
    if (cookieHash !== expected) {
      const url = request.nextUrl.clone();
      url.pathname = "/gate";
      url.search = `?from=${encodeURIComponent(
        request.nextUrl.pathname + request.nextUrl.search,
      )}`;
      return NextResponse.redirect(url);
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
