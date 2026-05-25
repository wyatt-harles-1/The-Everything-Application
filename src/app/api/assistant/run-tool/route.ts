// POST /api/assistant/run-tool — server-side commit for an approved
// mutation tool call. The chat UI calls this AFTER the user clicks
// Approve on a pending tool part, then submits the result back via
// addToolResult so the LLM continues the conversation.
//
// Auth + RLS are enforced via getUserContext; the master key isn't
// needed (this route doesn't decrypt API keys, just commits writes).

import { getUserContext } from "@/lib/db/session";
import { mutationSchemas, type MutationName } from "@/lib/ai/mutationSchemas";
import {
  agentScheduleEvent,
  agentMarkEventDone,
  agentMarkEventSkipped,
  agentCreateHabit,
  agentCreateGoal,
  agentUpdateGoalStatus,
  agentUpdateLiftingRules,
  agentUpdateRunningRules,
} from "@/lib/ai/mutations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as { tool: string; input: unknown };
  if (!body || typeof body.tool !== "string") {
    return Response.json({ ok: false, error: "Missing tool name" }, { status: 400 });
  }

  // Validate tool name + input against the central schema map.
  if (!(body.tool in mutationSchemas)) {
    return Response.json(
      { ok: false, error: `Unknown tool: ${body.tool}` },
      { status: 400 },
    );
  }
  const name = body.tool as MutationName;
  const schema = mutationSchemas[name];
  const parsed = schema.safeParse(body.input);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Input validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  // Dispatch. Per-name typed dispatch keeps every handler's input
  // narrowed; a switch over MutationName means TS will yell if a new
  // mutation is added to the schema map but not handled here.
  switch (name) {
    case "schedule_event":
      return Response.json(
        await agentScheduleEvent(
          ctx,
          parsed.data as Parameters<typeof agentScheduleEvent>[1],
        ),
      );
    case "mark_event_done":
      return Response.json(
        await agentMarkEventDone(
          ctx,
          parsed.data as Parameters<typeof agentMarkEventDone>[1],
        ),
      );
    case "mark_event_skipped":
      return Response.json(
        await agentMarkEventSkipped(
          ctx,
          parsed.data as Parameters<typeof agentMarkEventSkipped>[1],
        ),
      );
    case "create_habit":
      return Response.json(
        await agentCreateHabit(
          ctx,
          parsed.data as Parameters<typeof agentCreateHabit>[1],
        ),
      );
    case "create_goal":
      return Response.json(
        await agentCreateGoal(
          ctx,
          parsed.data as Parameters<typeof agentCreateGoal>[1],
        ),
      );
    case "update_goal_status":
      return Response.json(
        await agentUpdateGoalStatus(
          ctx,
          parsed.data as Parameters<typeof agentUpdateGoalStatus>[1],
        ),
      );
    case "update_lifting_rules":
      return Response.json(
        await agentUpdateLiftingRules(
          ctx,
          parsed.data as Parameters<typeof agentUpdateLiftingRules>[1],
        ),
      );
    case "update_running_rules":
      return Response.json(
        await agentUpdateRunningRules(
          ctx,
          parsed.data as Parameters<typeof agentUpdateRunningRules>[1],
        ),
      );
  }
}
