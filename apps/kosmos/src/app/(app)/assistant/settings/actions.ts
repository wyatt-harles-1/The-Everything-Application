// Server Actions for /assistant/settings. Upsert pattern keyed on
// user_id (PK on shared.user_ai_settings). Empty api_key field means
// "don't change the stored key" rather than "wipe it" so the form is
// safe to submit repeatedly.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { aiSettingsSchema } from "@/lib/validation/aiSettings";
import { encryptApiKey } from "@/lib/ai/encryption";
import { isManagedKeyAllowed } from "@/lib/ai/managedKey";
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

export async function saveAISettings(
  _prev: FormActionState,
  fd: FormData,
): Promise<FormActionState> {
  // Never echo the api_key back to the client — strip from captured
  // values so re-renders don't leak it.
  const values = (() => {
    const v = captureValues(fd);
    if (v && "api_key" in v) delete v.api_key;
    return v;
  })();

  const ctx = await getUserContext();
  if (!ctx) return { ok: false, banner: "Not signed in.", values };

  const parsed = aiSettingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { ok: false, banner: bannerFor(errors), errors, values };
  }
  const s = parsed.data;

  // Managed (app-owned) keys bill the operator, so only allowlisted accounts
  // may opt in. Reject up front with a clear message; provider.ts enforces the
  // same check again at the point of use as defense in depth.
  if (s.use_managed_key && !isManagedKeyAllowed(ctx.email)) {
    return {
      ok: false,
      banner:
        "The app's managed API key isn't available for your account. Add your own provider API key below instead.",
      values,
    };
  }

  // Find the existing row so we know whether to preserve the stored key.
  const { data: existing } = await ctx.supabase
    .schema("shared")
    .from("user_ai_settings")
    .select("api_key_encrypted")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  // If the user typed a new api_key, encrypt it. Otherwise preserve
  // whatever was there (could be null = no key yet).
  let nextEncryptedKey: string | null;
  if (s.api_key) {
    try {
      nextEncryptedKey = encryptApiKey(s.api_key);
    } catch (e) {
      return {
        ok: false,
        banner:
          e instanceof Error
            ? `Couldn't encrypt the key: ${e.message}`
            : "Encryption failed.",
        values,
      };
    }
  } else {
    nextEncryptedKey = existing?.api_key_encrypted ?? null;
  }

  const { error } = await ctx.supabase
    .schema("shared")
    .from("user_ai_settings")
    .upsert(
      {
        user_id: ctx.userId,
        provider: s.provider,
        model_id: s.model_id ?? null,
        api_key_encrypted: nextEncryptedKey,
        use_managed_key: s.use_managed_key,
        notes: s.notes ?? null,
      },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, banner: error.message, values };

  revalidatePath("/assistant/settings");
  revalidatePath("/assistant");
  redirect("/assistant/settings?flash=saved");
}

export async function clearAIKey(): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("shared")
    .from("user_ai_settings")
    .update({ api_key_encrypted: null, use_managed_key: false })
    .eq("user_id", ctx.userId);
  revalidatePath("/assistant/settings");
  redirect("/assistant/settings?flash=cleared");
}
