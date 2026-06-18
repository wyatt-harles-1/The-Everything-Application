"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { Select } from "@/components/forms/Select";
import { DateTimePicker } from "@/components/forms/DateTimePicker";
import { RatingScale } from "@/components/forms/RatingScale";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import { workoutKinds } from "@/lib/validation/wellness";

type Action = (
  prev: FormActionState,
  fd: FormData,
) => Promise<FormActionState>;

export type LiftingSetDraft = {
  exercise_name: string;
  set_number: number;
  reps: string;          // form fields are strings; coerced server-side
  weight_lbs: string;
  rpe: string;
  is_warmup: boolean;
  notes: string;
};

export type WorkoutFormDefaults = {
  started_at?: string;
  ended_at?: string;
  kind?: string;
  title?: string;
  perceived_effort?: number | null;
  notes?: string;
  location?: string;
  // For edit mode: existing children
  lifting_sets?: LiftingSetDraft[];
  cardio?: {
    distance_meters?: number | null;
    duration_seconds?: number | null;
    avg_heart_rate?: number | null;
    max_heart_rate?: number | null;
    elevation_gain_meters?: number | null;
    shoe_id?: string | null;
    route_notes?: string;
  };
  mobility?: {
    focus_area?: string;
    protocol?: string;
    duration_minutes?: number | null;
  };
};

function emptySet(n: number): LiftingSetDraft {
  return {
    exercise_name: "",
    set_number: n,
    reps: "",
    weight_lbs: "",
    rpe: "",
    is_warmup: false,
    notes: "",
  };
}

const cardioKinds = new Set(["running", "cycling", "swimming", "walk"]);

export function WorkoutForm({
  action,
  defaults = {},
  submitLabel,
  exerciseNames = [],
  activeShoes = [],
}: {
  action: Action;
  defaults?: WorkoutFormDefaults;
  submitLabel: string;
  /** Names from the user's exercise library, fed into the lifting sets
   *  autocomplete. Empty if the library is empty - in which case the input
   *  still works as plain free text. */
  exerciseNames?: string[];
  /** Active shoes (Phase 4d-running), fed into the cardio sub-form's shoe
   *  selector. Empty = the selector is hidden. */
  activeShoes?: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(
    action,
    null,
  );
  const errs = state && state.ok === false ? state.errors : undefined;

  const [kind, setKind] = useState<string>(defaults.kind ?? "lifting");
  const [sets, setSets] = useState<LiftingSetDraft[]>(
    defaults.lifting_sets && defaults.lifting_sets.length > 0
      ? defaults.lifting_sets
      : [emptySet(1)],
  );

  function updateSet(i: number, patch: Partial<LiftingSetDraft>) {
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addSet() {
    setSets((prev) => [...prev, emptySet(prev.length + 1)]);
  }
  function removeSet(i: number) {
    setSets((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        // Renumber set_number after a removal so what the user sees and what
        // the DB stores stay aligned.
        .map((s, idx) => ({ ...s, set_number: idx + 1 })),
    );
  }

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

      <FormField label="Kind" htmlFor="kind" required error={errs?.kind?.[0]}>
        <Select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {workoutKinds.map((k) => (
            <option key={k} value={k}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Started at"
          htmlFor="started_at"
          required
          error={errs?.started_at?.[0]}
        >
          <DateTimePicker
            id="started_at"
            name="started_at"
            required
            defaultValue={defaults.started_at}
          />
        </FormField>
        <FormField label="Ended at" htmlFor="ended_at" error={errs?.ended_at?.[0]}>
          <DateTimePicker
            id="ended_at"
            name="ended_at"
            defaultValue={defaults.ended_at}
          />
        </FormField>
      </div>

      <FormField label="Title" htmlFor="title" error={errs?.title?.[0]}>
        <TextInput
          id="title"
          name="title"
          placeholder={kind === "lifting" ? "Push day" : "Optional"}
          defaultValue={defaults.title}
        />
      </FormField>

      <FormField label="Location" htmlFor="location" error={errs?.location?.[0]}>
        <TextInput
          id="location"
          name="location"
          placeholder="Gym, home, trail …"
          defaultValue={defaults.location}
        />
      </FormField>

      <FormField
        label="Perceived effort"
        hint="optional, 1-10"
        error={errs?.perceived_effort?.[0]}
      >
        <RatingScale
          name="perceived_effort"
          defaultValue={defaults.perceived_effort ?? undefined}
        />
      </FormField>

      {/* ----- kind-specific sub-forms ----- */}
      {kind === "lifting" ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Sets</legend>
          {sets.map((s, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Set {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSet(i)}
                  className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  aria-label={`Remove set ${i + 1}`}
                >
                  Remove
                </button>
              </div>
              <FormField label="Exercise">
                <TextInput
                  value={s.exercise_name}
                  onChange={(e) => updateSet(i, { exercise_name: e.target.value })}
                  placeholder="Squat, bench, deadlift …"
                  list="exercise-library-names"
                  autoCapitalize="words"
                />
              </FormField>
              <div className="grid grid-cols-3 gap-2">
                <FormField label="Reps">
                  <NumberInput
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={s.reps}
                    onChange={(e) => updateSet(i, { reps: e.target.value })}
                  />
                </FormField>
                <FormField label="Weight (lbs)">
                  <NumberInput
                    min={0}
                    step="0.5"
                    value={s.weight_lbs}
                    onChange={(e) => updateSet(i, { weight_lbs: e.target.value })}
                  />
                </FormField>
                <FormField label="RPE">
                  <NumberInput
                    min={1}
                    max={10}
                    step="0.5"
                    value={s.rpe}
                    onChange={(e) => updateSet(i, { rpe: e.target.value })}
                  />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.is_warmup}
                  onChange={(e) => updateSet(i, { is_warmup: e.target.checked })}
                  className="h-4 w-4"
                />
                Warmup set
              </label>
              <FormField label="Set notes">
                <TextInput
                  value={s.notes}
                  onChange={(e) => updateSet(i, { notes: e.target.value })}
                  placeholder="Optional"
                />
              </FormField>
            </div>
          ))}
          <button
            type="button"
            onClick={addSet}
            className="min-h-11 w-full rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
          >
            + Add set
          </button>
          {/* Server Action reads this. */}
          <input
            type="hidden"
            name="lifting_sets_json"
            value={JSON.stringify(sets)}
          />
          {/* Native autocomplete from the exercise library - browser picks
              this up via the `list` attribute on each exercise input. */}
          {exerciseNames.length > 0 ? (
            <datalist id="exercise-library-names">
              {exerciseNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          ) : null}
        </fieldset>
      ) : null}

      {cardioKinds.has(kind) ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Cardio</legend>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Distance (m)" htmlFor="distance_meters">
              <NumberInput
                id="distance_meters"
                name="distance_meters"
                min={0}
                step="0.1"
                defaultValue={defaults.cardio?.distance_meters ?? ""}
              />
            </FormField>
            <FormField label="Duration (s)" htmlFor="duration_seconds">
              <NumberInput
                id="duration_seconds"
                name="duration_seconds"
                inputMode="numeric"
                min={0}
                step={1}
                defaultValue={defaults.cardio?.duration_seconds ?? ""}
              />
            </FormField>
            <FormField label="Avg HR" htmlFor="avg_heart_rate">
              <NumberInput
                id="avg_heart_rate"
                name="avg_heart_rate"
                inputMode="numeric"
                min={0}
                max={300}
                step={1}
                defaultValue={defaults.cardio?.avg_heart_rate ?? ""}
              />
            </FormField>
            <FormField label="Max HR" htmlFor="max_heart_rate">
              <NumberInput
                id="max_heart_rate"
                name="max_heart_rate"
                inputMode="numeric"
                min={0}
                max={300}
                step={1}
                defaultValue={defaults.cardio?.max_heart_rate ?? ""}
              />
            </FormField>
            <FormField
              label="Elevation (m)"
              htmlFor="elevation_gain_meters"
              hint="gain"
            >
              <NumberInput
                id="elevation_gain_meters"
                name="elevation_gain_meters"
                min={0}
                step="0.1"
                defaultValue={defaults.cardio?.elevation_gain_meters ?? ""}
              />
            </FormField>
          </div>
          {activeShoes.length > 0 ? (
            <FormField label="Shoe" htmlFor="shoe_id">
              <Select
                id="shoe_id"
                name="shoe_id"
                defaultValue={defaults.cardio?.shoe_id ?? ""}
              >
                <option value="">— none —</option>
                {activeShoes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}
          <FormField label="Route notes" htmlFor="route_notes">
            <TextArea
              id="route_notes"
              name="route_notes"
              rows={2}
              defaultValue={defaults.cardio?.route_notes}
            />
          </FormField>
        </fieldset>
      ) : null}

      {kind === "mobility" ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Mobility</legend>
          <FormField label="Focus area" htmlFor="focus_area">
            <TextInput
              id="focus_area"
              name="focus_area"
              placeholder="hips, shoulders, full body …"
              defaultValue={defaults.mobility?.focus_area}
            />
          </FormField>
          <FormField label="Protocol" htmlFor="protocol">
            <TextInput
              id="protocol"
              name="protocol"
              placeholder="Knees Over Toes warmup …"
              defaultValue={defaults.mobility?.protocol}
            />
          </FormField>
          <FormField label="Duration (min)" htmlFor="duration_minutes">
            <NumberInput
              id="duration_minutes"
              name="duration_minutes"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={defaults.mobility?.duration_minutes ?? ""}
            />
          </FormField>
        </fieldset>
      ) : null}

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
