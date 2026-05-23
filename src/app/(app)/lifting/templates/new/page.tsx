import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { TemplateForm } from "../TemplateForm";
import { createTemplate } from "../actions";

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const exerciseNames = (exercises ?? []).map((e) => e.name);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/lifting/templates" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Templates
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          New template
        </h1>
      </header>

      <TemplateForm
        action={createTemplate}
        submitLabel="Save template"
        exerciseNames={exerciseNames}
      />
    </div>
  );
}
