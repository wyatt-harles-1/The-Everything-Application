// Edit / delete a medication. The list of doses for this med lives back on
// /log/medication (the hub page) - this page is purely the medication's own
// metadata.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { toDateInputValue } from "@/components/forms/DatePicker";

import { MedicationForm } from "../MedicationForm";
import { updateMedication, deleteMedication } from "../actions";

export default async function MedicationDetailPage({
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
    .from("medications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/log/medication" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Back to medications
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Edit medication
        </h1>
      </header>

      {flash === "created" ? (
        <FlashBanner>Medication added ✓</FlashBanner>
      ) : flash === "updated" ? (
        <FlashBanner>Medication updated ✓</FlashBanner>
      ) : null}

      <MedicationForm
        action={updateMedication.bind(null, id)}
        submitLabel="Update medication"
        defaults={{
          name: row.name,
          dosage: row.dosage ?? "",
          frequency: row.frequency ?? "",
          started_on: row.started_on ? toDateInputValue(row.started_on) : undefined,
          ended_on: row.ended_on ? toDateInputValue(row.ended_on) : undefined,
          prescribing_doctor: row.prescribing_doctor ?? "",
          purpose: row.purpose ?? "",
          notes: row.notes ?? "",
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteMedication.bind(null, id)}>
        <button type="submit" className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
          Delete this medication (also deletes all logged doses)
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
