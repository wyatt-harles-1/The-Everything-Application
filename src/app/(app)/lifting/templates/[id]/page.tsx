// Template detail / edit. Reuses TemplateForm bound to updateTemplate, with
// a prominent "Start session" button at the top + a Delete at the bottom.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { TemplateForm, type TemplateExerciseDraft, type PlannedSetDraft } from "../TemplateForm";
import {
  updateTemplate,
  deleteTemplate,
  startSessionFromTemplate,
} from "../actions";

type RawPlannedSet = {
  reps?: number | null;
  weight_lbs?: number | null;
  rpe?: number | null;
  is_warmup?: boolean;
  notes?: string | null;
};

export default async function TemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;

  const supabase = await createClient();

  const { data: template, error } = await supabase
    .schema("wellness")
    .from("workout_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !template) notFound();

  const { data: exercisesRaw } = await supabase
    .schema("wellness")
    .from("template_exercises")
    .select("exercise_name, position, planned_sets, rest_seconds, notes")
    .eq("template_id", id)
    .order("position", { ascending: true });

  const exercises: TemplateExerciseDraft[] = (exercisesRaw ?? []).map((e) => ({
    exercise_name: e.exercise_name ?? "",
    rest_seconds: e.rest_seconds != null ? String(e.rest_seconds) : "",
    notes: e.notes ?? "",
    planned_sets: ((e.planned_sets ?? []) as RawPlannedSet[]).map(
      (s): PlannedSetDraft => ({
        reps: s.reps != null ? String(s.reps) : "",
        weight_lbs: s.weight_lbs != null ? String(s.weight_lbs) : "",
        rpe: s.rpe != null ? String(s.rpe) : "",
        is_warmup: s.is_warmup ?? false,
        notes: s.notes ?? "",
      }),
    ),
  }));

  const { data: libExercises } = await supabase
    .schema("wellness")
    .from("exercises")
    .select("name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const exerciseNames = (libExercises ?? []).map((e) => e.name);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/lifting/templates" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Templates
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {template.name}
        </h1>
      </header>

      {flash === "created" ? <Banner>Template created ✓</Banner> : null}
      {flash === "updated" ? <Banner>Template updated ✓</Banner> : null}

      <form action={startSessionFromTemplate.bind(null, id)}>
        <button
          type="submit"
          className="min-h-12 w-full rounded-md bg-zinc-950 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Start session →
        </button>
      </form>

      <TemplateForm
        action={updateTemplate.bind(null, id)}
        submitLabel="Update template"
        exerciseNames={exerciseNames}
        defaults={{
          name: template.name,
          description: template.description ?? "",
          notes: template.notes ?? "",
          exercises,
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteTemplate.bind(null, id)}>
        <button
          type="submit"
          className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete this template
        </button>
      </form>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
