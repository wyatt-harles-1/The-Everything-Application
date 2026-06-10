// Bloodwork is two-table: bloodwork_panels (parent, the lab draw) +
// bloodwork_results (one row per marker). The panel optionally has a PDF /
// image uploaded to the `bloodwork` Storage bucket.
//
// Pattern: insert the panel first to get an id, then upload to
// {user_id}/{panel_id}.{ext}, then UPDATE the panel's file_path. The
// dynamic-row results come in as a JSON string from the client (same
// approach as lifting_sets in the workout form).

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  bloodworkPanelSchema,
  bloodworkResultSchema,
} from "@/lib/validation/wellness";
import {
  recordEvent,
  updateEventForDetail,
  deleteEventForDetail,
} from "@/lib/db/events";
import {
  getUserContext,
  captureValues,
  type FormActionState,
} from "@/lib/db/session";
import type { SupabaseClient } from "@supabase/supabase-js";

const resultsArraySchema = z.array(bloodworkResultSchema);

function toDateOnly(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function panelSummary(panel: { panel_type?: string | null }, resultCount: number): string {
  const parts: string[] = [];
  if (panel.panel_type) parts.push(panel.panel_type);
  parts.push(`${resultCount} marker${resultCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

// Upload the file to {user_id}/{panel_id}.{ext}; returns the path or null
// if no file was provided.
// A lab result is a PDF or an image — nothing else should ever land in the
// bucket. Both the extension and the content type are attacker-controlled (the
// browser sends file.name and file.type verbatim), so an unrestricted upload
// lets someone store e.g. an .html/text/html (or scriptable .svg) file that
// then executes when opened via its signed URL on the *.supabase.co origin
// (stored XSS / phishing in that origin). We allowlist a fixed set of inert
// types and force the stored content type from the allowlist (never file.type),
// so the object can only ever be served as a PDF or a raster image — never as
// active content. (svg is deliberately excluded for this reason.)
const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
};

async function uploadPanelFile(
  supabase: SupabaseClient,
  userId: string,
  panelId: string,
  file: File | null,
): Promise<{ path: string | null; error?: string }> {
  if (!file || file.size === 0) return { path: null };

  // Limit file size to 25 MB (typical lab PDF is < 1 MB; the cap is a guard).
  if (file.size > 25 * 1024 * 1024) {
    return { path: null, error: "File too large (25 MB max)." };
  }

  // Extension drives the allowlist. A missing/extension-less name is rejected
  // rather than defaulted, so nothing untyped reaches storage.
  const nameParts = file.name.split(".");
  const ext = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : "";
  const contentType = ALLOWED_UPLOAD_TYPES[ext];
  if (!contentType) {
    return {
      path: null,
      error: "Unsupported file type. Upload a PDF or image (png, jpg, webp, heic).",
    };
  }
  const path = `${userId}/${panelId}.${ext}`;

  const { error } = await supabase.storage
    .from("bloodwork")
    // contentType is forced from our allowlist, NOT from the client's file.type.
    .upload(path, file, { upsert: true, contentType });
  if (error) return { path: null, error: error.message };
  return { path };
}

async function writeResults(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
  panelId: string,
  resultsJson: string,
): Promise<{ count: number; error?: string }> {
  let raw: unknown;
  try {
    raw = JSON.parse(resultsJson || "[]");
  } catch {
    return { count: 0, error: "Results payload was malformed." };
  }
  const parsed = resultsArraySchema.safeParse(raw);
  if (!parsed.success) {
    return { count: 0, error: parsed.error.issues[0]?.message ?? "Result validation failed." };
  }
  if (parsed.data.length === 0) return { count: 0 };

  const { error } = await supabase
    .schema("wellness")
    .from("bloodwork_results")
    .insert(
      parsed.data.map((r) => ({
        user_id: userId,
        source_id: sourceId,
        panel_id: panelId,
        marker_name: r.marker_name,
        value: r.value ?? null,
        value_text: r.value_text ?? null,
        unit: r.unit ?? null,
        reference_low: r.reference_low ?? null,
        reference_high: r.reference_high ?? null,
        flag: r.flag ?? null,
        notes: r.notes ?? null,
      })),
    );
  if (error) return { count: 0, error: error.message };
  return { count: parsed.data.length };
}

// Build an actionable banner sentence from the fieldErrors map so the user
// doesn't see a generic "invalid input" they have to hunt for. e.g.
// "Fix the drawn_at, panel_type fields below."
function bannerFor(fieldErrors: Record<string, string[] | undefined>): string {
  const names = Object.entries(fieldErrors)
    .filter(([, v]) => v && v.length)
    .map(([k]) => k);
  if (names.length === 0) return "Fix the highlighted fields below.";
  return `Fix the ${names.join(", ")} field${names.length === 1 ? "" : "s"} below.`;
}

export async function createBloodwork(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = bloodworkPanelSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const p = parsed.data;

  // 1. Insert the panel (no file_path yet).
  const { data: panel, error: insertErr } = await ctx.supabase
    .schema("wellness")
    .from("bloodwork_panels")
    .insert({
      user_id: ctx.userId,
      source_id: ctx.sourceId,
      drawn_at: toDateOnly(p.drawn_at),
      lab_name: p.lab_name ?? null,
      ordering_provider: p.ordering_provider ?? null,
      panel_type: p.panel_type ?? null,
      notes: p.notes ?? null,
    })
    .select("id")
    .single();
  if (insertErr || !panel) {
    return {
      ok: false,
      banner: insertErr?.message ?? "Failed to save panel.",
      values,
    };
  }

  // 2. Upload the file (if any).
  const file = fd.get("file") as File | null;
  const upload = await uploadPanelFile(ctx.supabase, ctx.userId, panel.id, file);
  if (upload.error) {
    // Roll back the panel so we don't leave an orphan.
    await ctx.supabase.schema("wellness").from("bloodwork_panels").delete().eq("id", panel.id);
    return { ok: false, banner: upload.error, values };
  }
  if (upload.path) {
    await ctx.supabase
      .schema("wellness")
      .from("bloodwork_panels")
      .update({ file_path: upload.path })
      .eq("id", panel.id);
  }

  // 3. Insert the result rows.
  const resultsJson = (fd.get("results_json") as string | null) ?? "[]";
  const results = await writeResults(ctx.supabase, ctx.userId, ctx.sourceId, panel.id, resultsJson);
  if (results.error) {
    // Don't roll back panel - the file + panel are valid even without
    // structured results. Surface the error so user can retry results entry.
    return {
      ok: false,
      banner: `Panel saved but results failed: ${results.error}`,
      values,
    };
  }

  // 4. Emit event. The panel is the event; results are not.
  const eventTs = new Date(`${toDateOnly(p.drawn_at)}T12:00:00Z`).toISOString();
  const { error: evtErr } = await recordEvent(ctx.supabase, {
    userId: ctx.userId,
    sourceId: ctx.sourceId,
    domain: "wellness",
    eventType: "bloodwork_panel",
    occurredAt: eventTs,
    detailTable: "wellness.bloodwork_panels",
    detailId: panel.id,
    title: p.panel_type ?? "Bloodwork panel",
    summary: panelSummary(p, results.count),
  });
  if (evtErr) {
    return {
      ok: false,
      banner: `Panel saved but event sync failed: ${evtErr.message}`,
      values,
    };
  }

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/bloodwork/${panel.id}?flash=created`);
}

export async function updateBloodwork(
  id: string,
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = bloodworkPanelSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const p = parsed.data;

  // Optional new file - if present, overwrite the existing object.
  const file = fd.get("file") as File | null;
  let newPath: string | null | undefined = undefined; // undefined = no change
  if (file && file.size > 0) {
    const upload = await uploadPanelFile(ctx.supabase, ctx.userId, id, file);
    if (upload.error) return { ok: false, banner: upload.error, values };
    newPath = upload.path;
  }

  const update: Record<string, unknown> = {
    drawn_at: toDateOnly(p.drawn_at),
    lab_name: p.lab_name ?? null,
    ordering_provider: p.ordering_provider ?? null,
    panel_type: p.panel_type ?? null,
    notes: p.notes ?? null,
  };
  if (newPath !== undefined) update.file_path = newPath;

  const { error } = await ctx.supabase
    .schema("wellness")
    .from("bloodwork_panels")
    .update(update)
    .eq("id", id);
  if (error) return { ok: false, banner: error.message, values };

  // Wipe + reinsert results (same approach as workout sub-tables).
  await ctx.supabase.schema("wellness").from("bloodwork_results").delete().eq("panel_id", id);
  const resultsJson = (fd.get("results_json") as string | null) ?? "[]";
  const results = await writeResults(ctx.supabase, ctx.userId, ctx.sourceId, id, resultsJson);
  if (results.error) {
    return {
      ok: false,
      banner: `Panel updated but results failed: ${results.error}`,
      values,
    };
  }

  const eventTs = new Date(`${toDateOnly(p.drawn_at)}T12:00:00Z`).toISOString();
  await updateEventForDetail(ctx.supabase, {
    detailTable: "wellness.bloodwork_panels",
    detailId: id,
    occurredAt: eventTs,
    title: p.panel_type ?? "Bloodwork panel",
    summary: panelSummary(p, results.count),
  });

  revalidatePath("/log");
  revalidatePath("/");
  redirect(`/log/bloodwork/${id}?flash=updated`);
}

export async function deleteBloodwork(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // Best-effort: remove the stored file. RLS scopes the bucket so only the
  // owner's objects can be touched.
  const { data: panel } = await ctx.supabase
    .schema("wellness")
    .from("bloodwork_panels")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (panel?.file_path) {
    await ctx.supabase.storage.from("bloodwork").remove([panel.file_path]);
  }

  await deleteEventForDetail(ctx.supabase, {
    detailTable: "wellness.bloodwork_panels",
    detailId: id,
  });
  // bloodwork_results cascade on the panel's ON DELETE CASCADE.
  await ctx.supabase.schema("wellness").from("bloodwork_panels").delete().eq("id", id);

  revalidatePath("/log");
  revalidatePath("/");
  redirect("/log?flash=deleted");
}
