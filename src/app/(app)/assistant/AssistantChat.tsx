"use client";

// Streaming chat surface. The useChat hook from @ai-sdk/react manages
// optimistic UI, message buffer, and stream consumption; we just render
// + provide an input. v1 is pure text - tools, confirmations, and
// thread persistence ship in later sub-waves.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

// Tool names that require user approval. Kept in sync with mutationTools
// on the server; if it gains a new key, add it here too. Read tools are
// not in this set, so the UI never blocks on them.
const MUTATION_TOOL_NAMES = new Set([
  "schedule_event",
  "mark_event_done",
  "mark_event_skipped",
  "create_habit",
  "create_goal",
  "update_goal_status",
  "update_lifting_rules",
  "update_running_rules",
  "remember_fact",
  "forget_fact",
]);

export function AssistantChat({
  providerLabel,
  modelLabel,
  threadId,
  initialMessages,
}: {
  providerLabel: string | null;
  modelLabel: string | null;
  threadId: string | null;
  initialMessages: { id: string; role: "user" | "assistant" | "system"; parts: unknown[] }[];
}) {
  const router = useRouter();
  // Track the effective thread id. May start null (brand-new chat); the
  // server creates one on first message and returns it in x-thread-id.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    threadId,
  );

  const { messages, sendMessage, addToolResult, status, error } = useChat({
    // The persisted message shape matches AI SDK v6's UIMessage, but the
    // outer cast keeps the hook happy without us reasserting every part
    // type. Tool-call parts inside roundtrip verbatim.
    messages: initialMessages as unknown as UIMessage[],
    transport: new DefaultChatTransport({
      api: "/api/assistant/chat",
      // Sent on every request; lets the chat route attach new turns to
      // the right thread or create a new one when null.
      body: () => ({ threadId: activeThreadId }),
      // Custom fetch wrapper picks up x-thread-id from the response so
      // the client learns the new id the chat route created lazily on
      // the first message. setState dedupes if the value didn't change.
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        const newId = res.headers.get("x-thread-id");
        if (newId) setActiveThreadId(newId);
        return res;
      },
    }),
  });
  // First-message URL update: once the server tells us the new thread
  // id, push it into the URL so reloads + bookmarks hit the right
  // thread. router.replace avoids growing the back-stack on the very
  // first message of every new chat.
  useEffect(() => {
    if (activeThreadId && activeThreadId !== threadId) {
      router.replace(`/assistant?thread=${activeThreadId}`, {
        scroll: false,
      });
    }
  }, [activeThreadId, threadId, router]);
  const [input, setInput] = useState("");
  // Per tool-call id: track whether we're currently committing it so the
  // UI can show a spinner / disable buttons.
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(
    new Set(),
  );
  const isStreaming = status === "submitted" || status === "streaming";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
  }

  async function onApprove(
    toolCallId: string,
    toolName: string,
    input: unknown,
  ) {
    setPendingApprovals((prev) => new Set(prev).add(toolCallId));
    try {
      const res = await fetch("/api/assistant/run-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, input }),
      });
      const result = await res.json();
      addToolResult({
        tool: toolName,
        toolCallId,
        output: result,
      });
    } catch (e) {
      addToolResult({
        tool: toolName,
        toolCallId,
        output: {
          ok: false,
          error: e instanceof Error ? e.message : "Request failed",
        },
      });
    } finally {
      setPendingApprovals((prev) => {
        const next = new Set(prev);
        next.delete(toolCallId);
        return next;
      });
    }
  }

  function onReject(toolCallId: string, toolName: string) {
    addToolResult({
      tool: toolName,
      toolCallId,
      output: { ok: false, error: "User rejected the action." },
    });
  }

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-my-8">
      {/* Header strip */}
      <header className="sticky top-14 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ← Home
            </Link>
            <h1 className="text-base font-semibold">Assistant</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <Link
              href="/assistant/threads"
              className="hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              threads
            </Link>
            <Link
              href="/assistant/memory"
              className="hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              memory
            </Link>
            <Link
              href="/assistant/settings"
              className="hover:text-zinc-950 dark:hover:text-zinc-50"
            >
              {providerLabel ? `${providerLabel} · ${modelLabel}` : "settings"}
            </Link>
          </div>
        </div>
      </header>

      {/* Message list */}
      <div className="flex-1 space-y-4 px-4 py-4">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Phase 4e1: no tools wired yet. The assistant can chat but
            can&apos;t query your data until 4e2 lands.
          </p>
        ) : null}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role}>
            {m.parts.map((p, idx) => {
              if (p.type === "text") {
                return (
                  <span key={idx} className="whitespace-pre-wrap">
                    {p.text}
                  </span>
                );
              }
              // Tool-call parts: `tool-<toolName>` per AI SDK v6. Two
              // flavors:
              //  - Read tools: auto-executed; show JSON output for power
              //    users; nothing required from the human.
              //  - Mutation tools: have NO execute on the server; arrive
              //    in state "input-available" and stay there until the
              //    UI calls addToolResult. Render approve/reject buttons.
              if (typeof p.type === "string" && p.type.startsWith("tool-")) {
                const toolName = p.type.slice("tool-".length);
                const part = p as unknown as {
                  toolCallId: string;
                  state:
                    | "input-streaming"
                    | "input-available"
                    | "output-available"
                    | "output-error";
                  input?: unknown;
                  output?: unknown;
                  errorText?: string;
                };
                const isMutation = MUTATION_TOOL_NAMES.has(toolName);
                const awaitingApproval =
                  isMutation && part.state === "input-available";
                const running =
                  !isMutation &&
                  (part.state === "input-streaming" ||
                    part.state === "input-available");
                const isPendingCommit = pendingApprovals.has(part.toolCallId);

                return (
                  <details
                    key={idx}
                    open={awaitingApproval}
                    className={`mt-1 first:mt-0 rounded border px-2 py-1 text-[11px] ${
                      awaitingApproval
                        ? "border-violet-300 bg-violet-50/70 dark:border-violet-700 dark:bg-violet-950/40"
                        : "border-zinc-200 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-900/50"
                    }`}
                  >
                    <summary className="cursor-pointer select-none text-zinc-500 dark:text-zinc-400">
                      {awaitingApproval
                        ? "⚠"
                        : running
                          ? "⋯"
                          : part.state === "output-error"
                            ? "✗"
                            : "✓"}{" "}
                      <span
                        className={
                          isMutation
                            ? "font-medium text-violet-700 dark:text-violet-300"
                            : ""
                        }
                      >
                        {toolName}
                      </span>
                      {awaitingApproval ? " · awaiting approval" : null}
                      {part.state === "output-error" ? " · error" : null}
                    </summary>

                    {/* Always show the input args - especially for mutations
                        so the human sees exactly what's being proposed. */}
                    {part.input !== undefined ? (
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] text-zinc-700 dark:text-zinc-300">
                        {JSON.stringify(part.input, null, 2)}
                      </pre>
                    ) : null}

                    {awaitingApproval ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={isPendingCommit}
                          onClick={() =>
                            onApprove(
                              part.toolCallId,
                              toolName,
                              part.input,
                            )
                          }
                          className="min-h-8 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {isPendingCommit ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={isPendingCommit}
                          onClick={() =>
                            onReject(part.toolCallId, toolName)
                          }
                          className="min-h-8 rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}

                    {part.state === "output-available" ? (
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] text-zinc-600 dark:text-zinc-400">
                        {JSON.stringify(part.output, null, 2)}
                      </pre>
                    ) : part.state === "output-error" ? (
                      <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                        {part.errorText ?? "unknown error"}
                      </p>
                    ) : null}
                  </details>
                );
              }
              return null;
            })}
          </MessageBubble>
        ))}

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
            {error.message}
          </p>
        ) : null}
      </div>

      {/* Composer */}
      <footer className="sticky bottom-0 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={isStreaming}
            className="min-h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </form>
      </footer>
    </div>
  );
}

function MessageBubble({
  role,
  children,
}: {
  role: "user" | "assistant" | "system";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
            : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
