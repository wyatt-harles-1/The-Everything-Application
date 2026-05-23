"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import {
  muscleGroups,
  equipmentTypes,
} from "@/lib/lifting/starter-exercises";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type ExerciseFormDefaults = {
  name?: string;
  muscle_group?: string;
  equipment?: string;
  instructions?: string;
  notes?: string;
};

export function ExerciseForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: ExerciseFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(action, null);
  const errs = state && state.ok === false ? state.errors : undefined;
  const submitted = state && state.ok === false ? state.values : undefined;
  const pick = (name: string, fallback?: string) =>
    submitted?.[name] ?? fallback ?? "";

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && state.ok === false && state.banner ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {state.banner}
        </div>
      ) : null}

      <FormField label="Name" htmlFor="name" required error={errs?.name?.[0]}>
        <TextInput
          id="name"
          name="name"
          required
          placeholder="Back Squat"
          key={`name-${submitted ? "s" : "i"}`}
          defaultValue={pick("name", defaults.name)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Muscle group" htmlFor="muscle_group" error={errs?.muscle_group?.[0]}>
          <Select
            id="muscle_group"
            name="muscle_group"
            key={`mg-${submitted ? "s" : "i"}`}
            defaultValue={pick("muscle_group", defaults.muscle_group)}
          >
            <option value="">— select —</option>
            {muscleGroups.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Equipment" htmlFor="equipment" error={errs?.equipment?.[0]}>
          <Select
            id="equipment"
            name="equipment"
            key={`eq-${submitted ? "s" : "i"}`}
            defaultValue={pick("equipment", defaults.equipment)}
          >
            <option value="">— select —</option>
            {equipmentTypes.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Form cues / instructions" htmlFor="instructions" error={errs?.instructions?.[0]}>
        <TextArea
          id="instructions"
          name="instructions"
          rows={3}
          placeholder="brace, drive through heels, hips back…"
          key={`ins-${submitted ? "s" : "i"}`}
          defaultValue={pick("instructions", defaults.instructions)}
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          key={`n-${submitted ? "s" : "i"}`}
          defaultValue={pick("notes", defaults.notes)}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
