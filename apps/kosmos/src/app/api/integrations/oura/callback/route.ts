// GET /api/integrations/oura/callback — Oura redirects here after consent.
// Verify the CSRF state, exchange the code (Oura requires redirect_uri on the
// exchange), persist the encrypted Oura source, and bounce back to
// /integrations with a flag. Mirrors the Strava callback.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/integrations/oura";
import { upsertOuraSource } from "@/lib/integrations/sources";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const back = (query: string) => {
    const res = NextResponse.redirect(`${origin}/integrations?${query}`);
    res.cookies.set("oura_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (url.searchParams.get("error")) return back("error=oura_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("oura_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return back("error=oura_state");
  }

  try {
    // redirect_uri must match the one used to authorize.
    const redirectUri = `${origin}/api/integrations/oura/callback`;
    const token = await exchangeCode(code, redirectUri);
    const scope = url.searchParams.get("scope") ?? "";
    const scopes = scope ? scope.split(" ") : [];
    const { error } = await upsertOuraSource(supabase, user.id, token, scopes);
    if (error) return back("error=oura_save_failed");
    return back("connected=oura");
  } catch {
    return back("error=oura_exchange_failed");
  }
}
