import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { toDateInputValue } from "@/components/forms/DatePicker";

import { BloodworkForm, type ResultDraft } from "../BloodworkForm";
import { updateBloodwork, deleteBloodwork } from "../actions";

export default async function BloodworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;

  const supabase = await createClient();

  const { data: panel, error } = await supabase
    .schema("wellness")
    .from("bloodwork_panels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !panel) notFound();

  const { data: results } = await supabase
    .schema("wellness")
    .from("bloodwork_results")
    .select("*")
    .eq("panel_id", id)
    .order("created_at", { ascending: true });

  const draftResults: ResultDraft[] = (results ?? []).map((r) => ({
    marker_name: r.marker_name,
    value: r.value?.toString() ?? "",
    value_text: r.value_text ?? "",
    unit: r.unit ?? "",
    reference_low: r.reference_low?.toString() ?? "",
    reference_high: r.reference_high?.toString() ?? "",
    flag: r.flag ?? "",
    notes: r.notes ?? "",
  }));

  // If a file is on Storage, generate a short-lived signed URL so the user
  // can re-download / view it. The bucket is private; signed URL is the
  // standard way to grant temporary access.
  let signedFileUrl: string | null = null;
  if (panel.file_path) {
    const { data } = await supabase.storage
      .from("bloodwork")
      .createSignedUrl(panel.file_path, 600);    // 10 minutes
    signedFileUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/log" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Edit bloodwork panel
        </h1>
      </header>

      {flash === "created" ? (
        <FlashBanner>Panel logged ✓</FlashBanner>
      ) : flash === "updated" ? (
        <FlashBanner>Panel updated ✓</FlashBanner>
      ) : null}

      {signedFileUrl ? (
        <p className="text-sm">
          <a
            href={signedFileUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-4"
          >
            View uploaded file →
          </a>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            (link expires in 10 min)
          </span>
        </p>
      ) : null}

      <BloodworkForm
        action={updateBloodwork.bind(null, id)}
        submitLabel="Update panel"
        defaults={{
          drawn_at: toDateInputValue(panel.drawn_at),
          lab_name: panel.lab_name ?? "",
          ordering_provider: panel.ordering_provider ?? "",
          panel_type: panel.panel_type ?? "",
          notes: panel.notes ?? "",
          results: draftResults,
          existing_file_path: panel.file_path ?? undefined,
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteBloodwork.bind(null, id)}>
        <button type="submit" className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
          Delete this panel (also deletes results + uploaded file)
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
