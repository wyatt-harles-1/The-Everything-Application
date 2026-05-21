// Logout endpoint. POST-only so it can't be triggered by a stray <img> tag or
// a cross-site GET — the landing page renders a tiny form that posts here.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, {
    // 303 forces the browser to switch POST → GET on the redirect target.
    // Without this, some browsers will retry the redirect as POST.
    status: 303,
  });
}
