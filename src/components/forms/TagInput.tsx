// Comma-or-Enter to commit a tag; tags display as chips with a remove (×)
// button. The committed tags are persisted into a hidden input named
// `<name>` as a comma-separated string, which the Server Action splits back
// into an array.
//
// Client Component because it manages the chip list state.

"use client";

import { useState, type KeyboardEvent } from "react";

export function TagInput({
  name,
  defaultValue = [],
  placeholder = "Type and press Enter…",
}: {
  name: string;
  defaultValue?: string[];
  placeholder?: string;
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = raw.trim().toLowerCase();
    if (!next) return;
    if (tags.includes(next)) return;
    setTags((prev) => [...prev, next]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      // Backspace on empty input removes the last chip - convenient.
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function remove(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-300 bg-white p-1.5 focus-within:border-zinc-950 focus-within:ring-1 focus-within:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-50 dark:focus-within:ring-zinc-50">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => remove(t)}
              className="-mr-0.5 leading-none text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => commit(draft)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-h-9 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
      </div>
      {/* Hidden input carries the committed tags into the Server Action. */}
      <input type="hidden" name={name} value={tags.join(",")} />
    </div>
  );
}
