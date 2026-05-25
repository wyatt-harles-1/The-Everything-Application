// /assistant/memory - manage the facts the agent remembers about you.
// Anything in this list gets appended to the system prompt on every
// chat call (formatMemoriesForPrompt). Source pill distinguishes
// agent-proposed vs user-added entries.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { listMemories } from "@/lib/ai/persistence";

import { manualRememberFact, manualForgetFact } from "./actions";

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();
  const memories = await listMemories(supabase);

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
          Memory
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Stable facts the assistant should keep in mind across chats.
          Each entry is injected into its system prompt on every turn.
        </p>
      </header>

      {flash === "added" ? <Banner>Memory added ✓</Banner> : null}
      {flash === "removed" ? <Banner>Memory removed ✓</Banner> : null}
      {flash === "blank" ? (
        <Banner kind="warn">Fact text is required.</Banner>
      ) : null}

      <form action={manualRememberFact} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <input
            name="fact"
            placeholder="e.g. prefers morning workouts"
            required
            className="col-span-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
          />
          <input
            name="category"
            placeholder="category (optional)"
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Add memory
        </button>
      </form>

      {memories.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No memories yet. The assistant will propose some over time, or
          you can add your own above.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {memories.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex-1 space-y-0.5">
                <p className="text-sm">{m.fact}</p>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {m.category ? `${m.category} · ` : ""}
                  {m.source === "agent" ? "agent" : "user"} ·{" "}
                  {formatDate(m.updated_at)}
                </p>
              </div>
              <form action={manualForgetFact.bind(null, m.id)}>
                <button
                  type="submit"
                  aria-label="Forget"
                  className="h-8 w-8 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
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

function Banner({
  kind = "ok",
  children,
}: {
  kind?: "ok" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
