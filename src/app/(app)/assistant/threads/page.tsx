// /assistant/threads - chronological list of past conversations.
// "New chat" creates an empty thread and redirects into it.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { listThreads } from "@/lib/ai/persistence";

import { startNewThreadAction, deleteThreadAction } from "./actions";

export default async function ThreadsListPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();
  const threads = await listThreads(supabase);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/assistant"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Assistant
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Threads
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Every past conversation. Click to resume.
        </p>
      </header>

      {flash === "deleted" ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Thread deleted ✓
        </p>
      ) : null}

      <form action={startNewThreadAction}>
        <button
          type="submit"
          className="block min-h-12 w-full rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          + New chat
        </button>
      </form>

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No threads yet. Start a new chat to see it here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {threads.map((t) => (
            <li key={t.id} className="flex items-stretch gap-2">
              <Link
                href={`/assistant?thread=${t.id}`}
                className="flex-1 rounded-md border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="line-clamp-1 text-sm font-medium">
                    {t.title ?? "(untitled)"}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(t.last_message_at)}
                  </span>
                </div>
              </Link>
              <form action={deleteThreadAction.bind(null, t.id)}>
                <button
                  type="submit"
                  aria-label="Delete thread"
                  className="flex h-full w-10 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 hover:border-red-300 hover:text-red-600 dark:border-zinc-800 dark:hover:border-red-700 dark:hover:text-red-400"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
