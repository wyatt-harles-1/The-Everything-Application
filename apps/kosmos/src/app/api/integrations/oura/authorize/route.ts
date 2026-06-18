// GET /api/integrations/oura/authorize — start the Oura OAuth flow. Mirrors
// the Strava authorize route: auth-gate, mint a CSRF `state` cookie, redirect
// to Oura's consent screen with an origin-derived redirect_uri.

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, isOuraConfigured } from "@/lib/integrations/oura";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (!isOuraConfigured()) {
    return NextResponse.redirect(`${origin}/integrations?error=oura_not_configured`);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${origin}/api/integrations/oura/callback`;

  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set("oura_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
