"use client";

// Streaming chat surface. The useChat hook from @ai-sdk/react manages
// optimistic UI, message buffer, and stream consumption; we just render
// + provide an input. v1 is pure text - tools, confirmations, and
// thread persistence ship in later sub-waves.

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

import Link from "next/link";

export function AssistantChat({
  providerLabel,
  modelLabel,
}: {
  providerLabel: string | null;
  modelLabel: string | null;
}) {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/assistant/chat",
    }),
  });
  const [input, setInput] = useState("");
  const isStreaming = status === "submitted" || status === "streaming";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput("");
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
          <Link
            href="/assistant/settings"
            className="shrink-0 text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {providerLabel ? `${providerLabel} · ${modelLabel}` : "settings"} →
          </Link>
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
            {/* useChat v6+ exposes structured parts on each message; for
                v1 we render text parts only. Tool calls / files come
                in later sub-waves. */}
            {m.parts.map((p, idx) => {
              if (p.type === "text") {
                return (
                  <span key={idx} className="whitespace-pre-wrap">
                    {p.text}
                  </span>
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
