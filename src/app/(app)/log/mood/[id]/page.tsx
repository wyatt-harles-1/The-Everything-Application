import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { toDateTimeLocalUTC } from "@/lib/format";

import { MoodForm } from "../MoodForm";
import { updateMood, deleteMood } from "../actions";

export default async function MoodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .schema("wellness")
    .from("mood_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/log"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Edit mood
        </h1>
      </header>

      {flash === "created" ? (
        <FlashBanner>Mood logged ✓</FlashBanner>
      ) : flash === "updated" ? (
        <FlashBanner>Mood updated ✓</FlashBanner>
      ) : null}

      <MoodForm
        action={updateMood.bind(null, id)}
        submitLabel="Update mood"
        defaults={{
          occurred_at: toDateTimeLocalUTC(row.occurred_at),
          mood: row.mood,
          energy: row.energy,
          stress: row.stress,
          anxiety: row.anxiety,
          notes: row.notes ?? "",
          tags: row.tags ?? [],
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteMood.bind(null, id)}>
        <button
          type="submit"
          className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete this mood entry
        </button>
      </form>
    </div>
  );
}

function FlashBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
