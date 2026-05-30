// GET /api/integrations/strava/authorize — kick off the Strava OAuth flow.
// Requires a signed-in user, mints a CSRF `state` nonce (stored in an
// HttpOnly cookie and echoed by Strava on the callback), and redirects the
// browser to Strava's consent screen. The redirect_uri is derived from the
// request origin so it works in both local dev and production without config.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, isStravaConfigured } from "@/lib/integrations/strava";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (!isStravaConfigured()) {
    return NextResponse.redirect(`${origin}/integrations?error=not_configured`);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/integrations/strava/callback`;

  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the consent
  });
  return res;
}
