// /assistant/settings - pick provider, paste API key, choose model.
// The api_key input is write-only - we never decrypt + render it back,
// even when editing. A small "Key on file ✓" status tells the user
// whether one exists without leaking it.

import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { isMasterKeyConfigured } from "@/lib/ai/encryption";

import { AISettingsForm } from "./AISettingsForm";
import { saveAISettings, clearAIKey } from "./actions";

export default async function AISettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const { flash } = await searchParams;
  const supabase = await createClient();

  const { data: row } = await supabase
    .schema("shared")
    .from("user_ai_settings")
    .select(
      "provider, model_id, api_key_encrypted, use_managed_key, notes",
    )
    .maybeSingle();

  const hasKey = !!row?.api_key_encrypted;
  const masterReady = isMasterKeyConfigured();

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
          AI settings
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Bring your own key. Keys are encrypted at rest with AES-256-GCM.
        </p>
      </header>

      {flash === "saved" ? (
        <Banner kind="ok">Settings saved ✓</Banner>
      ) : null}
      {flash === "cleared" ? (
        <Banner kind="ok">Key removed.</Banner>
      ) : null}

      {!masterReady ? (
        <Banner kind="warn">
          <strong>AI_SETTINGS_MASTER_KEY isn&apos;t configured.</strong>{" "}
          Generate a 64-char hex string and add it to Vercel + .env.local
          before saving any key, otherwise encryption will fail.
        </Banner>
      ) : null}

      <AISettingsForm
        action={saveAISettings}
        submitLabel="Save settings"
        defaults={{
          provider: row?.provider ?? "anthropic",
          model_id: row?.model_id ?? "",
          use_managed_key: row?.use_managed_key ?? false,
          notes: row?.notes ?? "",
        }}
        hasKey={hasKey}
      />

      {hasKey ? (
        <form action={clearAIKey}>
          <button
            type="submit"
            className="min-h-11 rounded-md px-4 py-2 text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400"
          >
            Remove stored key
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "ok" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    kind === "ok"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return <p className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</p>;
}
