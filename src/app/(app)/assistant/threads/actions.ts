"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getUserContext } from "@/lib/db/session";
import { createThread } from "@/lib/ai/persistence";

export async function startNewThreadAction(): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  const { id } = await createThread(ctx.supabase, ctx.userId);
  revalidatePath("/assistant/threads");
  redirect(`/assistant?thread=${id}`);
}

export async function deleteThreadAction(id: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  // Messages cascade via FK ON DELETE CASCADE on thread_id.
  await ctx.supabase
    .schema("shared")
    .from("chat_threads")
    .delete()
    .eq("id", id);
  revalidatePath("/assistant/threads");
  redirect("/assistant/threads?flash=deleted");
}
