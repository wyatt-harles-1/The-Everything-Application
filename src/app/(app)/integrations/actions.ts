"use server";

// Server actions for the integrations hub — the user-triggered "Sync now" and
// "Disconnect" buttons. The actual import logic lives in
// src/lib/integrations/sync.ts (shared with the daily cron); these wrappers
// just resolve the signed-in user's RLS client, run the core, and revalidate.

import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";
import {
  getStravaSource,
  ensureFreshAccessToken,
  setSourceInactive,
  getOuraSource,
} from "@/lib/integrations/sources";
import { deauthorize, StravaError } from "@/lib/integrations/strava";
import { OuraError } from "@/lib/integrations/oura";
import { syncStravaSource, syncOuraSource } from "@/lib/integrations/sync";

export type SyncResult = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  message?: string;
};

function errorMessage(e: unknown): string {
  if (e instanceof StravaError || e instanceof OuraError) {
    return `${e.message}${e.detail ? ` (${e.detail})` : ""}`;
  }
  return e instanceof Error ? e.message : "Sync failed.";
}

export async function syncStrava(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getStravaSource(ctx.supabase);
  if (!source) return { ok: false, message: "Strava is not connected." };

  try {
    const { imported, skipped, detailErrors } = await syncStravaSource(
      ctx.supabase,
      ctx.userId,
      source,
    );
    revalidatePath("/integrations");
    revalidatePath("/running");
    revalidatePath("/");
    const message =
      detailErrors > 0
        ? `Imported ${imported}, skipped ${skipped}. ${detailErrors} activity detail(s) didn't save fully.`
        : undefined;
    return { ok: true, imported, skipped, message };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export async function disconnectStrava(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getStravaSource(ctx.supabase);
  if (!source) return { ok: true }; // already disconnected

  // Best-effort revoke at Strava; proceed to local disconnect regardless.
  try {
    const { accessToken } = await ensureFreshAccessToken(ctx.supabase, source);
    await deauthorize(accessToken);
  } catch {
    // ignore — we still deactivate locally below
  }

  await setSourceInactive(ctx.supabase, source.id);
  revalidatePath("/integrations");
  return { ok: true };
}

export async function syncOura(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getOuraSource(ctx.supabase);
  if (!source) return { ok: false, message: "Oura is not connected." };

  try {
    const { imported, skipped } = await syncOuraSource(
      ctx.supabase,
      ctx.userId,
      source,
    );
    revalidatePath("/integrations");
    revalidatePath("/health");
    revalidatePath("/");
    return { ok: true, imported, skipped };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export async function disconnectOura(): Promise<SyncResult> {
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, message: "Not signed in." };

  const source = await getOuraSource(ctx.supabase);
  if (!source) return { ok: true };

  // Oura has no documented public token-revoke endpoint, so this is a local
  // disconnect only: deactivate the source (history stays).
  await setSourceInactive(ctx.supabase, source.id);
  revalidatePath("/integrations");
  return { ok: true };
}
