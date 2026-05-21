// Smoke-test endpoint. Hit it from Vercel after deploying — and from local
// uptime monitors — to confirm the app can reach the database.
//
// Uses the admin (service_role) client so the health check works even when no
// user is signed in. service_role bypasses Row Level Security, so we
// deliberately only fetch a COUNT (head: true) — never any row data.

import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const supabase = createAdminClient();

    // count: "exact", head: true returns only the row count from the database
    // without transferring any actual rows — minimal and safe.
    const { error } = await supabase
      .schema("shared")
      .from("sources")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return Response.json({
      status: "ok",
      database: "connected",
      timestamp,
    });
  } catch (err) {
    return Response.json(
      {
        status: "error",
        database: "disconnected",
        message: err instanceof Error ? err.message : String(err),
        timestamp,
      },
      { status: 500 },
    );
  }
}
