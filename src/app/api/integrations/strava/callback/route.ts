// GET /api/integrations/strava/callback — Strava redirects the browser here
// after the user grants (or denies) access. We verify the CSRF state, trade
// the auth code for tokens, and persist the encrypted Strava source. Every
// exit path clears the state cookie and bounces back to /integrations with a
// connected= or error= flag the page turns into a banner.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/integrations/strava";
import { upsertStravaSource } from "@/lib/integrations/sources";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Redirect home with a flag, clearing the one-time state cookie.
  const back = (query: string) => {
    const res = NextResponse.redirect(`${origin}/integrations?${query}`);
    res.cookies.set("strava_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  // User denied consent on Strava's screen.
  if (url.searchParams.get("error")) return back("error=denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("strava_oauth_state")?.value;

  // CSRF + completeness check.
  if (!code || !state || !expectedState || state !== expectedState) {
    return back("error=state");
  }

  try {
    const token = await exchangeCode(code);
    const scope = url.searchParams.get("scope") ?? "";
    const scopes = scope ? scope.split(",") : [];
    const { error } = await upsertStravaSource(supabase, user.id, token, scopes);
    if (error) return back("error=save_failed");
    return back("connected=strava");
  } catch {
    // exchangeCode throws StravaError on a bad code / redirect mismatch.
    return back("error=exchange_failed");
  }
}
