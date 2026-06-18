"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  medicationSchema,
  medicationLogSchema,
} from "@/lib/validation/wellness";
import { recordEvent, deleteEventForDetail } from "@/lib/db/events";
import { getUserContext, type FormActionState } from "@/lib/db/session";

// Calendar date → "YYYY-MM-DD" string (DB column is DATE).
function toDateOnly(d: Date | undefined | null): string | null {
  if (!d) return null;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}


// ============================================================================
// Medications (registry - no event row)
// ============================================================================

export async function createMedication(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = medicationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const m = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("medications")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: m.name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      started_on: toDateOnly(m.started_on),
      ended_on: toDateOnly(m.ended_on),
      prescribing_doctor: m.prescribing_doctor ?? null,
      purpose: m.purpose ?? null,
      notes: m.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, banner: error?.message ?? "Save failed." };

  revalidatePath("/log/medication");
  redirect(`/log/medication/${row.id}?flash=created`);
}

export async function updateMedication(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = medicationSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const m = parsed.data;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("medications")
    .update({
      name: m.name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      started_on: toDateOnly(m.started_on),
      ended_on: toDateOnly(m.ended_on),
      prescribing_doctor: m.prescribing_doctor ?? null,
      purpose: m.purpose ?? null,
      notes: m.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message };

  revalidatePath("/log/medication");
  redirect(`/log/medication/${id}?flash=updated`);
}

export async function deleteMedication(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // The medication_logs rows reference this medication. They each emitted a
  // shared.events row. Cascade cleanly: delete all their events, then their
  // log rows, then the medication itself.
  const { data: doses } = await ctx.supabase
    .schema("wellness")
    .from("medication_logs")
    .select("id")
    .eq("medication_id", id);
  for (const d of doses ?? []) {
    await deleteEventForDetail(ctx.supabase, {
      detailTable: "wellness.medication_logs",
      detailId: d.id,
    });
  }
  await ctx.supabase
    .schema("wellness")
    .from("medication_logs")
    .delete()
    .eq("medication_id", id);
  await ctx.supabase
    .schema("wellness")
    .from("medications")
    .delete()
    .eq("id", id);

  revalidatePath("/log/medication");
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log/medication?flash=med_deleted");
}


// ============================================================================
// Medication logs (one event per dose)
// ============================================================================

function buildDoseSummary(medName: string, log: {
  dose_taken?: string | null;
  skipped: boolean;
}): { title: string; summary: string } {
  if (log.skipped) {
    return { title: `${medName} (skipped)`, summary: "Dose skipped" };
  }
  return {
    title: medName,
    summary: log.dose_taken ? `Dose: ${log.dose_taken}` : "Dose taken",
  };
}

export async function logDose(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in." };

  const parsed = medicationLogSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const l = parsed.data;

  // Lookup med name for the event title.
  const { data: med } = await ctx.supabase
    .schema("wellness")
    .from("medications")
    .select("name")
    .eq("id", l.medication_id)
    .maybeSingle();
  if (!med) {
    return { ok: false, banner: "Medication not found (or not yours)." };
  }

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("medication_logs")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      medication_id: l.medication_id,
      taken_at: l.taken_at.toISOString(),
      dose_taken: l.dose_taken ?? null,
      skipped: l.skipped,
      notes: l.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, banner: error?.message ?? "Save failed." };

  const { title, summary } = buildDoseSummary(med.name, l);
  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "medication_taken",
    occurredAt: l.taken_at.toISOString(),
    detailTable: "wellness.medication_logs",
    detailId: row.id,
    title,
    summary,
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Dose logged but event sync failed: ${evtErr.message}`,
    };
  }

  revalidatePath("/log/medication");
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log/medication?flash=dose_logged");
}

export async function deleteDose(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.medication_logs",
    detailId: id,
  });
  await ctx.supabase
    .schema("wellness")
    .from("medication_logs")
    .delete()
    .eq("id", id);

  revalidatePath("/log/medication");
  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log/medication?flash=dose_deleted");
}

