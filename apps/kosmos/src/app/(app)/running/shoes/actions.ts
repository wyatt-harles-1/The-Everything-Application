// Server Actions for /running/shoes. CRUD + retire/restore. Tool-shaped
// per invariant #7. Master agent (Phase 4e) will call these to manage
// the shoe rotation programmatically.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { shoeSchema } from "@/lib/validation/shoes";
import { milesToMeters } from "@/lib/running/format";
import {
  getUserContext,
  captureValues,
  type FormActionState,
} from "@/lib/db/session";

function bannerFor(fieldErrors: Record<string, string[] | undefined>): string {
  const names = Object.entries(fieldErrors)
    .filter(([, v]) => v && v.length)
    .map(([k]) => k);
  if (names.length === 0) return "Fix the highlighted fields below.";
  return `Fix the ${names.join(", ")} field${names.length === 1 ? "" : "s"} below.`;
}

export async function createShoe(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = shoeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const s = parsed.data;

  const { data: row, error } = await ctx.supabase
    .schema("wellness")
    .from("shoes")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      name: s.name,
      brand: s.brand ?? null,
      model: s.model ?? null,
      retire_at_meters:
        s.retire_at_miles != null ? milesToMeters(s.retire_at_miles) : null,
      started_at: s.started_at.toISOString().slice(0, 10),
      retired_at: s.retired_at
        ? s.retired_at.toISOString().slice(0, 10)
        : null,
      notes: s.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    return { ok: false, banner: error?.message ?? "Failed to save.", values };
  }

  revalidatePath("/running");
  revalidatePath("/running/shoes");
  redirect(`/running/shoes/${row.id}?flash=created`);
}

export async function updateShoe(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = shoeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const s = parsed.data;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("shoes")
    .update({
      name: s.name,
      brand: s.brand ?? null,
      model: s.model ?? null,
      retire_at_meters:
        s.retire_at_miles != null ? milesToMeters(s.retire_at_miles) : null,
      started_at: s.started_at.toISOString().slice(0, 10),
      retired_at: s.retired_at
        ? s.retired_at.toISOString().slice(0, 10)
        : null,
      notes: s.notes ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/running");
  revalidatePath("/running/shoes");
  revalidatePath(`/running/shoes/${id}`);
  redirect(`/running/shoes/${id}?flash=updated`);
}

export async function retireShoe(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const today = new Date().toISOString().slice(0, 10);
  await ctx.supabase
    .schema("wellness")
    .from("shoes")
    .update({ retired_at: today })
    .eq("id", id);
  revalidatePath("/running");
  revalidatePath("/running/shoes");
  revalidatePath(`/running/shoes/${id}`);
  redirect(`/running/shoes/${id}?flash=retired`);
}

export async function restoreShoe(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("wellness")
    .from("shoes")
    .update({ retired_at: null })
    .eq("id", id);
  revalidatePath("/running");
  revalidatePath("/running/shoes");
  revalidatePath(`/running/shoes/${id}`);
  redirect(`/running/shoes/${id}?flash=restored`);
}

export async function deleteShoe(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  // cardio_sessions.shoe_id is ON DELETE SET NULL so past runs stay,
  // they just lose the attribution.
  await ctx.supabase.schema("wellness").from("shoes").delete().eq("id", id);
  revalidatePath("/running");
  revalidatePath("/running/shoes");
  redirect("/running/shoes?flash=deleted");
}
