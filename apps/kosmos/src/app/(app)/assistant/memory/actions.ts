"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";

export async function manualRememberFact(formData: FormData): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const fact = (formData.get("fact") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim() || null;
  if (!fact) {
    redirect("/assistant/memory?flash=blank");
  }
  await ctx.supabase
    .schema("shared")
    .from("assistant_memory")
    .insert({
      user_id: ctx.userId,
      fact,
      category,
      source: "user",
    });
  revalidatePath("/assistant/memory");
  redirect("/assistant/memory?flash=added");
}

export async function manualForgetFact(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  await ctx.supabase
    .schema("shared")
    .from("assistant_memory")
    .delete()
    .eq("id", id);
  revalidatePath("/assistant/memory");
  redirect("/assistant/memory?flash=removed");
}
