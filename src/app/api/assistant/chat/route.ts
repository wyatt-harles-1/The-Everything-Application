// POST /api/assistant/chat - streams an LLM response with read-only
// tools wired in (Phase 4e2). Mutations + rules edits land in 4e3-4e4.

import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";

import { createClient } from "@/lib/supabase/server";
import {
  getModelForUser,
  AINotConfiguredError,
} from "@/lib/ai/provider";
import { buildReadTools } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the user's personal assistant inside Life Hub, a single-user personal management app that aggregates wellness, lifting, running, scheduling, habits, and goals data.

You have read-only tools for querying the user's data:
- get_today_summary: one-shot daily briefing (today's schedule + active mesocycle + top goals + habits). Call this first for general "how's today/this week" questions.
- query_events: cross-domain timeline reader with domain/event_type/days filters.
- query_workouts: parent workout rows (any kind). Use get_lift_pr for specific lift records and query_recent_runs for running detail.
- get_lift_pr: best e1RM for a fuzzy-matched exercise name.
- get_active_mesocycle: current training block week/N + deload status.
- query_habits: active habits with this-week progress + streak.
- query_goals: goals filtered by status.
- query_recent_runs: runs with miles, duration, pace, HR.
- query_sleep, query_mood: recent wellness entries.

Style guidelines:
- Wyatt is a software engineer who prefers terse, direct answers over warm ones. No "Great question!" preambles.
- Quote concrete numbers from tool results (e.g., "you bench 240 lbs e1RM, hit Tuesday"). Don't paraphrase past clarity.
- If a tool returns empty/null, say so plainly instead of guessing.
- You can chain tools when a question requires it. Example: "how's lifting going?" -> call get_active_mesocycle + get_today_summary + maybe query_workouts(kind:lifting).
- You cannot mutate anything yet. If the user asks you to schedule, log, or edit something, tell them mutations ship in 4e3.

If the user just asks a conversational question with no data lookup, answer directly without calling tools.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let model;
  try {
    const resolved = await getModelForUser(supabase, user.id);
    model = resolved.model;
  } catch (e) {
    if (e instanceof AINotConfiguredError) {
      return Response.json(
        { error: e.message, code: "ai_not_configured" },
        { status: 400 },
      );
    }
    throw e;
  }

  const body = (await req.json()) as { messages: UIMessage[] };
  const messages = await convertToModelMessages(body.messages ?? []);

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools: buildReadTools(supabase, user.id),
    // Cap multi-step tool calling so a runaway loop can't burn tokens.
    // 6 steps lets the model chain 2-3 tool calls then write a response.
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
