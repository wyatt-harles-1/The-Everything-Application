// MealForm - reused for both /log/meal/new and /log/meal/[id].
// The page passes a Server Action to `action`; defaults populate when editing.

"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { Select } from "@/components/forms/Select";
import { DateTimePicker } from "@/components/forms/DateTimePicker";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (
  prev: FormActionState,
  fd: FormData,
) => Promise<FormActionState>;

export type MealFormDefaults = {
  occurred_at?: string;          // datetime-local: "YYYY-MM-DDTHH:mm"
  meal_type?: string;
  description?: string;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  notes?: string;
};

export function MealForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: MealFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(
    action,
    null,
  );
  const errs = state && state.ok === false ? state.errors : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && state.ok === false && state.banner ? (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
        >
          {state.banner}
        </div>
      ) : null}

      <FormField
        label="When"
        htmlFor="occurred_at"
        required
        error={errs?.occurred_at?.[0]}
      >
        <DateTimePicker
          id="occurred_at"
          name="occurred_at"
          required
          defaultValue={defaults.occurred_at}
        />
      </FormField>

      <FormField label="Meal type" htmlFor="meal_type" error={errs?.meal_type?.[0]}>
        <Select id="meal_type" name="meal_type" defaultValue={defaults.meal_type ?? ""}>
          <option value="">— select —</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
          <option value="other">Other</option>
        </Select>
      </FormField>

      <FormField
        label="Description"
        htmlFor="description"
        required
        error={errs?.description?.[0]}
      >
        <TextInput
          id="description"
          name="description"
          required
          placeholder="2 eggs + toast"
          defaultValue={defaults.description}
        />
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Macros (optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Calories" htmlFor="calories" error={errs?.calories?.[0]}>
            <NumberInput
              id="calories"
              name="calories"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={defaults.calories ?? ""}
            />
          </FormField>
          <FormField label="Protein (g)" htmlFor="protein_g" error={errs?.protein_g?.[0]}>
            <NumberInput
              id="protein_g"
              name="protein_g"
              min={0}
              step="0.1"
              defaultValue={defaults.protein_g ?? ""}
            />
          </FormField>
          <FormField label="Carbs (g)" htmlFor="carbs_g" error={errs?.carbs_g?.[0]}>
            <NumberInput
              id="carbs_g"
              name="carbs_g"
              min={0}
              step="0.1"
              defaultValue={defaults.carbs_g ?? ""}
            />
          </FormField>
          <FormField label="Fat (g)" htmlFor="fat_g" error={errs?.fat_g?.[0]}>
            <NumberInput
              id="fat_g"
              name="fat_g"
              min={0}
              step="0.1"
              defaultValue={defaults.fat_g ?? ""}
            />
          </FormField>
          <FormField label="Fiber (g)" htmlFor="fiber_g" error={errs?.fiber_g?.[0]}>
            <NumberInput
              id="fiber_g"
              name="fiber_g"
              min={0}
              step="0.1"
              defaultValue={defaults.fiber_g ?? ""}
            />
          </FormField>
        </div>
      </fieldset>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaults.notes}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
