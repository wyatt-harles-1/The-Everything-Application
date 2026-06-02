// POST /api/assistant/chat - streams an LLM response with full tool +
// persistence wiring (Phase 4e5).
//
// On every call:
//  1. Validate auth, resolve model from the user's settings.
//  2. Load assistant memory and inject into the system prompt.
//  3. Ensure a thread exists (create lazily if the client didn't pass one).
//  4. Persist the user's new turn before streaming.
//  5. Stream the response; onFinish persists the assistant turn.

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
import { buildSpecialistTools } from "@/lib/ai/specialists";
import { mutationTools } from "@/lib/ai/mutationTools";
import {
  appendMessages,
  createThread,
  deriveThreadTitle,
  formatMemoriesForPrompt,
  listMemories,
} from "@/lib/ai/persistence";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_SYSTEM_PROMPT = `You are the user's personal assistant inside Life Hub, a single-user personal management app that aggregates wellness, lifting, running, scheduling, habits, and goals data.

READ-ONLY TOOLS (auto-execute; results stream back to you):
- get_today_summary: one-shot daily briefing. Call first for "how's today/this week" questions.
- query_events / query_workouts / query_recent_runs / query_sleep / query_mood / query_readiness / query_habits / query_goals: filtered reads.
- query_readiness: recent Oura recovery (readiness score, HRV, resting HR, temp deviation) — for recovery questions and correlating recovery with training.
- get_lift_pr: best e1RM for a fuzzy-matched exercise name.
- get_active_mesocycle: current training block.
- get_lifting_rules / get_running_rules: read the user's module rules tables. Always read before proposing an update so the user sees the diff.

MUTATION TOOLS (require the USER to approve in the UI before committing):
- schedule_event: add a planned event to the calendar.
- mark_event_done / mark_event_skipped: lifecycle a planned event.
- create_habit: new recurring habit with weekly target.
- create_goal: new shared.goals row.
- update_goal_status: flip a goal to active / paused / achieved / abandoned.
- update_lifting_rules / update_running_rules: partial-update the module rules table (invariant #8).
- remember_fact: save a short factual statement that persists across chat sessions. Use sparingly - only stable preferences/facts that change advice in future conversations.
- forget_fact: delete a stored memory by id.

SPECIALIST SUB-AGENTS (you command these; they auto-execute and return a finding + optional proposals):
- consult_lifting / consult_running / consult_health / consult_goals: delegate a domain question to a focused coach sub-agent. It reads that domain deeply and returns an expert finding, plus any concrete change "proposals".
- Delegate genuinely analytical or cross-cutting questions ("analyze my lifting progress and what's lagging", "how's my recovery this week"). For a single fact ("what's my bench PR"), use the direct read tools - don't delegate.
- When a question spans multiple domains, call several consult_* tools IN THE SAME step so they run in parallel.
- Specialists can't see this chat. Put everything they need into the self-contained "question" you pass them.
- A specialist's "proposals" are recommendations, not actions. To act on one, YOU call the matching mutation tool (e.g. update_lifting_rules) with that proposal's input, and tell the user which coach suggested it. The usual approve/reject gate then applies. Never claim a specialist changed anything itself.
- Synthesize specialist findings into your own concise answer; don't just echo them.

Rules of engagement:
- Wyatt prefers terse, direct answers over warm ones. No "Great question!" preambles.
- Quote concrete numbers from tool results. If a tool returns empty/null, say so plainly.
- Before calling a mutation, briefly state what you're about to do in plain English so the approve/reject button has context.
- Don't apologize for needing approval; it's the safety contract, not a bug.
- You can chain reads then a mutation in one turn.
- Today's date is in the system's timezone; pick reasonable defaults and let the user override.`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

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

  const body = (await req.json()) as {
    messages: UIMessage[];
    threadId?: string | null;
  };

  // Lazy-create the thread if the client didn't pass one. Title is
  // derived from the first user message.
  let threadId = body.threadId ?? null;
  const newUserMessage = body.messages[body.messages.length - 1];
  if (!threadId) {
    const title =
      newUserMessage?.role === "user"
        ? deriveThreadTitle(newUserMessage.parts)
        : null;
    const created = await createThread(supabase, user.id, title ?? undefined);
    threadId = created.id;
  }

  // Persist the newest user turn before streaming. Older messages are
  // already on disk from previous calls in this thread.
  if (newUserMessage && newUserMessage.role === "user") {
    await appendMessages(supabase, user.id, threadId, [
      { role: "user", parts: newUserMessage.parts },
    ]);
  }

  // Memory injection: fetch all facts the agent should remember about
  // the user and append to the base system prompt. The same memory block
  // is threaded into the specialists so they share the user's context.
  const memories = await listMemories(supabase);
  const memoryBlock = formatMemoriesForPrompt(memories);
  const systemPrompt = BASE_SYSTEM_PROMPT + memoryBlock;

  const modelMessages = await convertToModelMessages(body.messages ?? []);

  const persistedThreadId = threadId;
  const result = streamText({
    model,
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      ...buildReadTools(supabase),
      ...buildSpecialistTools(supabase, model, memoryBlock),
      ...mutationTools,
    },
    // Higher than the single-agent budget (was 8): a turn may consult
    // multiple specialists and then relay their proposals as mutations.
    // The specialists' own internal steps don't count against this.
    stopWhen: stepCountIs(12),
    onFinish: async ({ response }) => {
      // Persist every new assistant message produced this turn. The
      // response.messages array carries assistant turns AND tool-result
      // turns; we only persist the assistant ones (tool results live
      // inside the assistant message's parts).
      const newAssistantMessages = response.messages
        .filter((m) => m.role === "assistant")
        .map((m) => ({
          role: "assistant" as const,
          parts: m.content,
        }));
      if (newAssistantMessages.length > 0) {
        await appendMessages(
          supabase,
          user.id,
          persistedThreadId,
          newAssistantMessages,
        );
      }
    },
  });

  // Include the (possibly newly created) thread id in a custom header
  // so the client can update its URL on first message.
  const response = result.toUIMessageStreamResponse();
  response.headers.set("x-thread-id", threadId);
  return response;
}
