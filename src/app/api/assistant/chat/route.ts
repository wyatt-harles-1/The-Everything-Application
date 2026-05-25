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
import { mutationTools } from "@/lib/ai/mutationTools";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the user's personal assistant inside Life Hub, a single-user personal management app that aggregates wellness, lifting, running, scheduling, habits, and goals data.

READ-ONLY TOOLS (auto-execute; results stream back to you):
- get_today_summary: one-shot daily briefing. Call first for "how's today/this week" questions.
- query_events / query_workouts / query_recent_runs / query_sleep / query_mood / query_habits / query_goals: filtered reads.
- get_lift_pr: best e1RM for a fuzzy-matched exercise name.
- get_active_mesocycle: current training block.
- get_lifting_rules / get_running_rules: read the user's module rules tables. Always read before proposing an update so the user sees the diff.

MUTATION TOOLS (require the USER to approve in the UI before committing):
- schedule_event: add a planned event to the calendar.
- mark_event_done / mark_event_skipped: lifecycle a planned event.
- create_habit: new recurring habit with weekly target.
- create_goal: new shared.goals row.
- update_goal_status: flip a goal to active / paused / achieved / abandoned.
- update_lifting_rules / update_running_rules: partial-update the module rules table (invariant #8). Only include fields you actually want to change - absent fields preserve their current value. Use these to encode preferences the suggestion engine + future automation will respect ("lift 4x/week", "prefer Tue/Thu/Sat", "skip deload weeks").

Rules of engagement:
- Wyatt prefers terse, direct answers over warm ones. No "Great question!" preambles.
- Quote concrete numbers from tool results. If a tool returns empty/null, say so plainly.
- Before calling a mutation, briefly state what you're about to do in plain English so the approve/reject button has context. Example: "I'll schedule a lift for Wednesday at 5pm — approve?"
- Don't apologize for needing approval; it's the safety contract, not a bug.
- You can chain reads then a mutation in one turn. Example: query_goals -> identify the right id -> update_goal_status.
- Today's date is in the system's timezone; when scheduling, pick reasonable defaults (e.g., next Wednesday 5pm) and let the user override.`;

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
    tools: {
      ...buildReadTools(supabase, user.id),
      // Mutation tools have no `execute` - client renders an approve
      // button and calls /api/assistant/run-tool to commit.
      ...mutationTools,
    },
    // Cap multi-step tool calling so a runaway loop can't burn tokens.
    // 8 steps lets the model chain a few reads then a mutation + final
    // response without hitting the ceiling.
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}
