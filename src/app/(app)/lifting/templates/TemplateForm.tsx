// Strong/RP-style template builder. Nested dynamic lists: exercises contain
// planned sets, both can be added/removed/reordered. Whole template
// serializes to one JSON blob in a hidden input.
//
// UX choices borrowed from Strong:
//  - "Add set" copies the last set's values (saves typing the same
//    weight/reps across straight sets).
//  - Up/down buttons reorder exercises within the template.
//  - The exercise name input has datalist autocomplete from the library.

"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type PlannedSetDraft = {
  reps: string;
  weight_lbs: string;
  rpe: string;
  is_warmup: boolean;
  notes: string;
};

export type TemplateExerciseDraft = {
  exercise_name: string;
  rest_seconds: string;
  notes: string;
  planned_sets: PlannedSetDraft[];
};

export type TemplateFormDefaults = {
  name?: string;
  description?: string;
  notes?: string;
  exercises?: TemplateExerciseDraft[];
};

function emptySet(): PlannedSetDraft {
  return {
    reps: "",
    weight_lbs: "",
    rpe: "",
    is_warmup: false,
    notes: "",
  };
}
function emptyExercise(): TemplateExerciseDraft {
  return {
    exercise_name: "",
    rest_seconds: "",
    notes: "",
    planned_sets: [emptySet()],
  };
}

export function TemplateForm({
  action,
  defaults = {},
  submitLabel,
  exerciseNames = [],
}: {
  action: Action;
  defaults?: TemplateFormDefaults;
  submitLabel: string;
  exerciseNames?: string[];
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(action, null);
  const banner = state && state.ok === false ? state.banner : undefined;

  const [name, setName] = useState(defaults.name ?? "");
  const [description, setDescription] = useState(defaults.description ?? "");
  const [notes, setNotes] = useState(defaults.notes ?? "");
  const [exercises, setExercises] = useState<TemplateExerciseDraft[]>(
    defaults.exercises && defaults.exercises.length > 0
      ? defaults.exercises
      : [emptyExercise()],
  );

  function updateExercise(idx: number, patch: Partial<TemplateExerciseDraft>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()]);
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveExercise(idx: number, dir: -1 | 1) {
    setExercises((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function updateSet(eIdx: number, sIdx: number, patch: Partial<PlannedSetDraft>) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === eIdx
          ? {
              ...e,
              planned_sets: e.planned_sets.map((s, k) =>
                k === sIdx ? { ...s, ...patch } : s,
              ),
            }
          : e,
      ),
    );
  }
  function addSet(eIdx: number) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === eIdx
          ? {
              ...e,
              planned_sets: [
                ...e.planned_sets,
                // Copy the last set's values - Strong-app pattern. Saves the
                // user from retyping 5×5 same-weight straight sets.
                e.planned_sets.length > 0
                  ? { ...e.planned_sets[e.planned_sets.length - 1], notes: "" }
                  : emptySet(),
              ],
            }
          : e,
      ),
    );
  }
  function removeSet(eIdx: number, sIdx: number) {
    setExercises((prev) =>
      prev.map((e, i) =>
        i === eIdx
          ? { ...e, planned_sets: e.planned_sets.filter((_, k) => k !== sIdx) }
          : e,
      ),
    );
  }

  // Shape the JSON blob the Server Action expects.
  const templateJson = JSON.stringify({
    name,
    description,
    notes,
    exercises: exercises.map((e, i) => ({
      exercise_name: e.exercise_name,
      position: i,
      rest_seconds: e.rest_seconds,
      notes: e.notes,
      planned_sets: e.planned_sets,
    })),
  });

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {banner ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {banner}
        </div>
      ) : null}

      <FormField label="Name" htmlFor="name" required>
        <TextInput
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Push A, 5/3/1 Bench, Pull Day…"
          autoCapitalize="words"
        />
      </FormField>

      <FormField label="Description" htmlFor="description">
        <TextInput
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
        />
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Exercises</legend>

        {exercises.map((ex, eIdx) => (
          <div
            key={eIdx}
            className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Exercise {eIdx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveExercise(eIdx, -1)}
                  disabled={eIdx === 0}
                  aria-label="Move up"
                  className="h-8 w-8 rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveExercise(eIdx, 1)}
                  disabled={eIdx === exercises.length - 1}
                  aria-label="Move down"
                  className="h-8 w-8 rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeExercise(eIdx)}
                  className="ml-1 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  aria-label="Remove exercise"
                >
                  Remove
                </button>
              </div>
            </div>

            <FormField label="Exercise">
              <TextInput
                value={ex.exercise_name}
                onChange={(e) => updateExercise(eIdx, { exercise_name: e.target.value })}
                placeholder="Back Squat"
                list="exercise-library-names"
                autoCapitalize="words"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Rest (sec)">
                <NumberInput
                  inputMode="numeric"
                  min={0}
                  step={5}
                  value={ex.rest_seconds}
                  onChange={(e) => updateExercise(eIdx, { rest_seconds: e.target.value })}
                  placeholder="120"
                />
              </FormField>
              <FormField label="Notes">
                <TextInput
                  value={ex.notes}
                  onChange={(e) => updateExercise(eIdx, { notes: e.target.value })}
                  placeholder="Optional"
                />
              </FormField>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Planned sets
              </p>
              {ex.planned_sets.map((s, sIdx) => (
                <div
                  key={sIdx}
                  className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/40 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Set {sIdx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSet(eIdx, sIdx)}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                      aria-label={`Remove set ${sIdx + 1}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField label="Reps">
                      <NumberInput
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={s.reps}
                        onChange={(e) => updateSet(eIdx, sIdx, { reps: e.target.value })}
                      />
                    </FormField>
                    <FormField label="Weight">
                      <NumberInput
                        min={0}
                        step="2.5"
                        value={s.weight_lbs}
                        onChange={(e) => updateSet(eIdx, sIdx, { weight_lbs: e.target.value })}
                      />
                    </FormField>
                    <FormField label="RPE">
                      <NumberInput
                        min={1}
                        max={10}
                        step="0.5"
                        value={s.rpe}
                        onChange={(e) => updateSet(eIdx, sIdx, { rpe: e.target.value })}
                      />
                    </FormField>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={s.is_warmup}
                      onChange={(e) => updateSet(eIdx, sIdx, { is_warmup: e.target.checked })}
                      className="h-4 w-4"
                    />
                    Warmup
                  </label>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addSet(eIdx)}
                className="min-h-9 w-full rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
              >
                + Add set (copies last)
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addExercise}
          className="min-h-11 w-full rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
        >
          + Add exercise
        </button>

        {exerciseNames.length > 0 ? (
          <datalist id="exercise-library-names">
            {exerciseNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        ) : null}
      </fieldset>

      <FormField label="Template notes" htmlFor="t_notes">
        <TextArea
          id="t_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="When to run this, prog notes, etc."
        />
      </FormField>

      <input type="hidden" name="template_json" value={templateJson} />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
