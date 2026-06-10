// Persists the home dashboard layout (widget order + hidden set) to the user's
// shared.user_preferences row. Best-effort: if the table doesn't exist yet
// (migration deferred) or the user is signed out, it returns ok:false and the
// client keeps the layout for the session only.

"use server";

import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";

import { HOME_WIDGET_IDS, type HomeLayout } from "./layout";

function onlyValidIds(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (id): id is string =>
      typeof id === "string" &&
      (HOME_WIDGET_IDS as readonly string[]).includes(id),
  );
}

export async function saveHomeLayout(
  layout: HomeLayout,
): Promise<{ ok: boolean }> {
  const clean: HomeLayout = {
    order: onlyValidIds(layout?.order),
    hidden: onlyValidIds(layout?.hidden),
  };

  try {
    const ctx = await getUserContext();
    if (!ctx) return { ok: false };
    const { error } = await ctx.supabase
      .schema("shared")
      .from("user_preferences")
      .upsert(
        { user_id: ctx.userId, home_layout: clean },
        { onConflict: "user_id" },
      );
    if (error) return { ok: false };
  } catch {
    return { ok: false };
  }

  revalidatePath("/");
  return { ok: true };
}
