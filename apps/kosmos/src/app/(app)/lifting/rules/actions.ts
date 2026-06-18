// Server Actions for /lifting/rules. The first activation of invariant
// #8 (per-module rules table). Today the user mutates these rows
// directly; in Phase 4e the master agent will call these same actions
// as "tools" to tune lifting-module behavior.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { liftingRulesSchema } from "@/lib/validation/liftingRules";
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

export async function saveLiftingRules(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  const values = captureValues(fd);
  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  // Reshape the multi-checkbox preferred_days into a number[] before
  // Zod parses. FormData.getAll returns string[], we coerce to numbers.
  const preferredRaw = fd.getAll("preferred_days").map((v) => Number(v));
  const preferred_days = preferredRaw.filter(
    (n) => Number.isFinite(n) && n >= 1 && n <= 7,
  );

  const parsed = liftingRulesSchema.safeParse({
    ...Object.fromEntries(fd),
    preferred_days: preferred_days.length > 0 ? preferred_days : undefined,
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const r = parsed.data;

  // Upsert keyed on user_id (PK on lifting_rules). One row per user.
  const { error } = await ctx.supabase
    .schema("wellness")
    .from("lifting_rules")
    .upsert(
      {
        user_id: ctx.userId,
        source_id: ctx.sourceId,
        frequency_per_week: r.frequency_per_week,
        preferred_days: r.preferred_days ?? null,
        default_time: r.default_time,
        skip_deload: r.skip_deload,
        notes: r.notes ?? null,
      },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/lifting/rules");
  revalidatePath("/lifting");
  revalidatePath("/schedule");
  redirect("/lifting/rules?flash=saved");
}
