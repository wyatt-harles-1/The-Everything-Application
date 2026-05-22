import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { toDateTimeLocalUTC } from "@/lib/format";

import { BodyForm } from "../BodyForm";
import { updateBody, deleteBody } from "../actions";

export default async function BodyDetailPage({
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
    .from("body_composition")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/log" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Edit body measurement
        </h1>
      </header>

      {flash === "created" ? (
        <FlashBanner>Measurement logged ✓</FlashBanner>
      ) : flash === "updated" ? (
        <FlashBanner>Measurement updated ✓</FlashBanner>
      ) : null}

      <BodyForm
        action={updateBody.bind(null, id)}
        submitLabel="Update measurement"
        defaults={{
          measured_at: toDateTimeLocalUTC(row.measured_at),
          weight_lbs: row.weight_lbs,
          body_fat_pct: row.body_fat_pct,
          skeletal_muscle_lbs: row.skeletal_muscle_lbs,
          waist_in: row.waist_in,
          chest_in: row.chest_in,
          arm_in: row.arm_in,
          thigh_in: row.thigh_in,
          notes: row.notes ?? "",
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteBody.bind(null, id)}>
        <button type="submit" className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
          Delete this measurement
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
