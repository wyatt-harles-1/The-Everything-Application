// /assistant - chat surface. With ?thread=<id>: hydrate the existing
// conversation. Without: auto-route to the most recent thread, or
// create one if none exist. /assistant/threads is the alternate entry
// point for picking a different conversation.

import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { isMasterKeyConfigured } from "@/lib/ai/encryption";
import { listThreads, loadThread } from "@/lib/ai/persistence";

import { AssistantChat } from "./AssistantChat";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .schema("shared")
    .from("user_ai_settings")
    .select("provider, model_id, api_key_encrypted, use_managed_key")
    .maybeSingle();

  const masterReady = isMasterKeyConfigured();
  const hasKey =
    settings &&
    (settings.api_key_encrypted !== null || settings.use_managed_key);
  const ready = settings && hasKey && masterReady;

  if (!ready) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Home
          </Link>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Assistant
          </h1>
        </header>
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            One more step before you can chat.
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-amber-900 dark:text-amber-100">
            {!masterReady ? (
              <li>
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">
                  AI_SETTINGS_MASTER_KEY
                </code>{" "}
                isn&apos;t set in env. Generate a 64-char hex string and
                add it to Vercel + .env.local.
              </li>
            ) : null}
            {!settings || !hasKey ? (
              <li>
                Pick a provider + paste an API key on{" "}
                <Link
                  href="/assistant/settings"
                  className="underline underline-offset-4"
                >
                  /assistant/settings
                </Link>
                .
              </li>
            ) : null}
          </ul>
          <Link
            href="/assistant/settings"
            className="inline-block min-h-11 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Open settings →
          </Link>
        </div>
      </div>
    );
  }

  // Resolve which thread to show. With ?thread=<id>, hydrate it.
  // Otherwise auto-open the most recent existing thread, or null
  // (let the client lazy-create on first message).
  const { thread: threadParam } = await searchParams;
  let threadId: string | null = threadParam ?? null;
  let initialMessages: { id: string; role: "user" | "assistant" | "system"; parts: unknown[] }[] = [];

  if (threadId) {
    const { thread, messages } = await loadThread(supabase, threadId);
    if (!thread) {
      // Stale id - silently fall back to most-recent / empty.
      threadId = null;
    } else {
      initialMessages = messages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: Array.isArray(m.parts) ? m.parts : [],
      }));
    }
  }
  if (!threadId) {
    const recent = await listThreads(supabase);
    if (recent.length > 0) {
      redirect(`/assistant?thread=${recent[0].id}`);
    }
  }

  return (
    <AssistantChat
      providerLabel={settings.provider}
      modelLabel={settings.model_id ?? "default"}
      threadId={threadId}
      initialMessages={initialMessages}
    />
  );
}
