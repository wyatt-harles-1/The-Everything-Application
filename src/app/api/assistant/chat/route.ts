// POST /api/assistant/chat - streams an LLM response over the user's
// configured provider. v1 has no tools; 4e2 will add read-only tools,
// 4e3 mutations, 4e4 rules-table edits. This route stays the single
// entry point - tools are appended to the streamText() call as they
// land.

import { streamText, convertToModelMessages, type UIMessage } from "ai";

import { createClient } from "@/lib/supabase/server";
import {
  getModelForUser,
  AINotConfiguredError,
} from "@/lib/ai/provider";

// Run in the Node.js runtime (default for App Router) because the
// AI SDK provider packages and our encryption helper rely on
// `node:crypto`. The Edge runtime is faster but doesn't ship that module.
export const runtime = "nodejs";

// Hard cap on the response stream to keep accidental loops bounded.
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the user's personal assistant inside Life Hub, a single-user personal management app that aggregates wellness, lifting, running, scheduling, habits, and goals data.

Today you have NO tools - you can only respond conversationally. If the user asks about their data ("how was my week?", "what's on the schedule?", etc.), tell them you'll be able to answer that once tool support ships in the next sub-wave (4e2). Keep responses short and direct - the user is a software engineer who values clarity over warmth.

Phase 4e1 is the foundation; the rest of the AI's capabilities ship in 4e2-4e7.`;

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
  });

  return result.toUIMessageStreamResponse();
}
