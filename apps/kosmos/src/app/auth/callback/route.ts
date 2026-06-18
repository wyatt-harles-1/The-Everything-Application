// Legacy magic-link landing endpoint. We've moved to the OTP-code flow
// (login form sends a 6-digit code, user types it). This route exists so
// that any old magic-link email someone might still click doesn't 404; it
// just redirects them back to /login with a friendly explainer.
//
// PKCE exchange via exchangeCodeForSession is intentionally NOT attempted -
// PKCE only works when the click happens in the same browser as the submit,
// which is exactly the cross-device pain point that pushed us to OTP codes.

import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // If Supabase passed an explicit error_description, surface it.
  const supabaseError = searchParams.get("error_description");
  const message =
    supabaseError ??
    "Magic links are no longer used - request a new 6-digit code below.";

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(message)}`,
  );
}
