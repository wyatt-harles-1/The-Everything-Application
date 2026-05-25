// POST /api/assistant/threads - create a new (empty) chat thread. The
// chat route also lazily creates one if the client doesn't pass an id;
// this endpoint is for the "New chat" button on /assistant/threads.

import { getUserContext } from "@/lib/db/session";
import { createThread } from "@/lib/ai/persistence";

export const runtime = "nodejs";

export async function POST() {
  const ctx = await getUserContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { id } = await createThread(ctx.supabase, ctx.userId);
  return Response.json({ id });
}
