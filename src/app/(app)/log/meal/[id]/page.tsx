// Meal detail / edit page. Shows the saved meal in form fields (the same
// MealForm used to create it) bound to updateMeal. A small separate <form>
// underneath posts to deleteMeal.

import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { toDateTimeLocalUTC } from "@/lib/format";

import { MealForm } from "../MealForm";
import { updateMeal, deleteMeal } from "../actions";

export default async function MealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  const { id } = await params;
  const { flash } = await searchParams;

  const supabase = await createClient();
  const { data: meal, error } = await supabase
    .schema("wellness")
    .from("meals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !meal) notFound();

  // Bind id into the Server Action so the form's `action` matches the
  // (prevState, formData) shape useActionState expects.
  const updateAction = updateMeal.bind(null, id);
  const deleteAction = deleteMeal.bind(null, id);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/log"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Edit meal
        </h1>
      </header>

      {flash === "created" ? (
        <FlashBanner>Meal logged ✓</FlashBanner>
      ) : flash === "updated" ? (
        <FlashBanner>Meal updated ✓</FlashBanner>
      ) : null}

      <MealForm
        action={updateAction}
        submitLabel="Update meal"
        defaults={{
          occurred_at: toDateTimeLocalUTC(meal.occurred_at),
          meal_type: meal.meal_type ?? "",
          description: meal.description,
          calories: meal.calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          fiber_g: meal.fiber_g,
          notes: meal.notes ?? "",
        }}
      />

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <form action={deleteAction}>
        <button
          type="submit"
          className="text-sm text-red-600 underline underline-offset-4 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete this meal
        </button>
      </form>
    </div>
  );
}

function FlashBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {children}
    </p>
  );
}
