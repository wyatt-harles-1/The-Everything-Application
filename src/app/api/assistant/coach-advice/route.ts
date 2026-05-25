// GET /api/assistant/coach-advice?domain=lifting[&force=1]
//
// The inline "Coach says" cards on the module hubs call this on mount.
// First hit per day per domain triggers an LLM generation; subsequent
// hits in the same day return the cached row. Force=1 (used by the
// card's refresh button) bypasses the cache.

import { createClient } from "@/lib/supabase/server";
import {
  getOrGenerateCoachAdvice,
  type CoachDomain,
} from "@/lib/ai/coach";
import { AINotConfiguredError } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_DOMAINS: CoachDomain[] = [
  "lifting",
  "running",
  "health",
  "goals",
];

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const force = url.searchParams.get("force") === "1";

  if (!domain || !VALID_DOMAINS.includes(domain as CoachDomain)) {
    return Response.json(
      { error: "Invalid or missing domain" },
      { status: 400 },
    );
  }

  try {
    const result = await getOrGenerateCoachAdvice({
      supabase,
      userId: user.id,
      domain: domain as CoachDomain,
      force,
    });
    return Response.json(result);
  } catch (e) {
    if (e instanceof AINotConfiguredError) {
      return Response.json(
        { error: e.message, code: "ai_not_configured" },
        { status: 400 },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to generate" },
      { status: 500 },
    );
  }
}
