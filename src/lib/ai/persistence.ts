// Persistence helpers for chat threads + messages + assistant memory.
// All writes use the RLS-protected supabase client passed in by the
// caller so a leaked thread_id can't be used to read someone else's
// conversation.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";

export type StoredThread = {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: UIMessage["parts"];
  created_at: string;
};

export async function listThreads(
  supabase: SupabaseClient,
): Promise<StoredThread[]> {
  const { data } = await supabase
    .schema("shared")
    .from("chat_threads")
    .select("id, title, last_message_at, created_at")
    .order("last_message_at", { ascending: false });
  return (data ?? []) as StoredThread[];
}

export async function loadThread(
  supabase: SupabaseClient,
  id: string,
): Promise<{ thread: StoredThread | null; messages: StoredMessage[] }> {
  const [threadRes, msgsRes] = await Promise.all([
    supabase
      .schema("shared")
      .from("chat_threads")
      .select("id, title, last_message_at, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .schema("shared")
      .from("chat_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: true }),
  ]);
  return {
    thread: (threadRes.data ?? null) as StoredThread | null,
    messages: (msgsRes.data ?? []) as StoredMessage[],
  };
}

export async function createThread(
  supabase: SupabaseClient,
  userId: string,
  initialTitle?: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .schema("shared")
    .from("chat_threads")
    .insert({
      user_id: userId,
      title: initialTitle ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create thread");
  }
  return { id: data.id };
}

export async function appendMessages(
  supabase: SupabaseClient,
  userId: string,
  threadId: string,
  messages: { role: "user" | "assistant" | "system"; parts: unknown }[],
): Promise<void> {
  if (messages.length === 0) return;
  const rows = messages.map((m) => ({
    thread_id: threadId,
    user_id: userId,
    role: m.role,
    parts: m.parts,
  }));
  const { error } = await supabase
    .schema("shared")
    .from("chat_messages")
    .insert(rows);
  if (error) throw new Error(error.message);
  // Touch last_message_at so the threads list sorts correctly.
  await supabase
    .schema("shared")
    .from("chat_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);
}

// Best-effort thread title from the first user message. Keeps the list
// view scannable without invoking another LLM call.
export function deriveThreadTitle(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null;
  for (const p of parts) {
    if (
      p &&
      typeof p === "object" &&
      (p as { type?: unknown }).type === "text"
    ) {
      const text = (p as { text?: unknown }).text;
      if (typeof text === "string" && text.trim().length > 0) {
        const trimmed = text.trim().replace(/\s+/g, " ");
        return trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
      }
    }
  }
  return null;
}

// Memory ----------------------------------------------------------------

export type AssistantMemoryRow = {
  id: string;
  fact: string;
  category: string | null;
  source: "agent" | "user";
  updated_at: string;
};

export async function listMemories(
  supabase: SupabaseClient,
): Promise<AssistantMemoryRow[]> {
  const { data } = await supabase
    .schema("shared")
    .from("assistant_memory")
    .select("id, fact, category, source, updated_at")
    .order("updated_at", { ascending: false });
  return (data ?? []) as AssistantMemoryRow[];
}

// Compact text block that gets appended to the system prompt. Keeping
// it short to bound the token cost - the agent doesn't need every
// memory's metadata on every turn.
export function formatMemoriesForPrompt(
  memories: AssistantMemoryRow[],
): string {
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- ${m.fact}`);
  return `\n\nPersistent memory about the user (from previous conversations; act on these unless the user contradicts):\n${lines.join("\n")}`;
}
