// Magic-link landing endpoint. Supabase appends ?code=... to the redirect URL;
// we exchange that code for a session here, then send the user wherever they
// were trying to go (defaults to "/"). The session cookies are written by the
// server client's setAll callback in src/lib/supabase/server.ts.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` param lets us deep-link: e.g. /auth/callback?code=...&next=/settings
  // sends the user to /settings after a successful sign-in. Defaults to "/".
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing auth code.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
