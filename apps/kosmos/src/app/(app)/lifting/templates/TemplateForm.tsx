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

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  rir: string;
  tempo: string;
  is_warmup: boolean;
  notes: string;
};

export type TemplateExerciseDraft = {
  // Stable client-only id used to key the dnd-kit SortableContext. Not
  // persisted - regenerated each render mount, so hydrating defaults must
  // mint one too (see makeDndId below).
  dndId?: string;
  exercise_name: string;
  rest_seconds: string;
  notes: string;
  planned_sets: PlannedSetDraft[];
};

// Stable id generator for dnd-kit. crypto.randomUUID is available in
// modern browsers + Node; we never persist these ids, they're scoped to a
// single form mount.
function makeDndId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dnd-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

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
    rir: "",
    tempo: "",
    is_warmup: false,
    notes: "",
  };
}
function emptyExercise(): TemplateExerciseDraft {
  return {
    dndId: makeDndId(),
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
  // Ensure every exercise has a dndId. Server-hydrated defaults arrive
  // without one (the field isn't persisted), so mint here on first render.
  const [exercises, setExercises] = useState<TemplateExerciseDraft[]>(() => {
    const seed =
      defaults.exercises && defaults.exercises.length > 0
        ? defaults.exercises
        : [emptyExercise()];
    return seed.map((e) => (e.dndId ? e : { ...e, dndId: makeDndId() }));
  });

  // dnd-kit sensors. PointerSensor for mouse, TouchSensor for mobile, and
  // KeyboardSensor for accessibility. Activation distance prevents drag
  // from triggering on stray clicks inside input fields.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const oldIndex = prev.findIndex((e) => e.dndId === active.id);
      const newIndex = prev.findIndex((e) => e.dndId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function updateExercise(idx: number, patch: Partial<TemplateExerciseDraft>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function addExercise() {
    setExercises((prev) => [...prev, emptyExercise()]);
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={exercises.map((e) => e.dndId ?? "")}
            strategy={verticalListSortingStrategy}
          >
            {exercises.map((ex, eIdx) => (
              <SortableExerciseCard
                key={ex.dndId}
                id={ex.dndId ?? `e-${eIdx}`}
                exercise={ex}
                index={eIdx}
                onUpdateExercise={(patch) => updateExercise(eIdx, patch)}
                onRemoveExercise={() => removeExercise(eIdx)}
                onUpdateSet={(sIdx, patch) => updateSet(eIdx, sIdx, patch)}
                onAddSet={() => addSet(eIdx)}
                onRemoveSet={(sIdx) => removeSet(eIdx, sIdx)}
              />
            ))}
          </SortableContext>
        </DndContext>

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

// One sortable exercise card. dnd-kit's useSortable hook returns refs,
// transform CSS, and listeners that we attach to a dedicated drag handle
// (not the whole card - tapping inputs shouldn't start a drag).
function SortableExerciseCard({
  id,
  exercise,
  index,
  onUpdateExercise,
  onRemoveExercise,
  onUpdateSet,
  onAddSet,
  onRemoveSet,
}: {
  id: string;
  exercise: TemplateExerciseDraft;
  index: number;
  onUpdateExercise: (patch: Partial<TemplateExerciseDraft>) => void;
  onRemoveExercise: () => void;
  onUpdateSet: (sIdx: number, patch: Partial<PlannedSetDraft>) => void;
  onAddSet: () => void;
  onRemoveSet: (sIdx: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 ${
        isDragging ? "ring-2 ring-zinc-400 dark:ring-zinc-600" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Drag handle. Listeners + attributes only attach here so taps
              inside the form fields below never start a drag. */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder exercise"
            className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            ⋮⋮
          </button>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Exercise {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemoveExercise}
          className="px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
          aria-label="Remove exercise"
        >
          Remove
        </button>
      </div>

      <FormField label="Exercise">
        <TextInput
          value={exercise.exercise_name}
          onChange={(e) => onUpdateExercise({ exercise_name: e.target.value })}
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
            value={exercise.rest_seconds}
            onChange={(e) => onUpdateExercise({ rest_seconds: e.target.value })}
            placeholder="120"
          />
        </FormField>
        <FormField label="Notes">
          <TextInput
            value={exercise.notes}
            onChange={(e) => onUpdateExercise({ notes: e.target.value })}
            placeholder="Optional"
          />
        </FormField>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Planned sets
        </p>
        {exercise.planned_sets.map((s, sIdx) => (
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
                onClick={() => onRemoveSet(sIdx)}
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
                  onChange={(e) => onUpdateSet(sIdx, { reps: e.target.value })}
                />
              </FormField>
              <FormField label="Weight">
                <NumberInput
                  min={0}
                  step="2.5"
                  value={s.weight_lbs}
                  onChange={(e) => onUpdateSet(sIdx, { weight_lbs: e.target.value })}
                />
              </FormField>
              <FormField label="RPE">
                <NumberInput
                  min={1}
                  max={10}
                  step="0.5"
                  value={s.rpe}
                  onChange={(e) => onUpdateSet(sIdx, { rpe: e.target.value })}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Tempo" hint="e.g. 3-1-1-0">
                <TextInput
                  value={s.tempo}
                  onChange={(e) => onUpdateSet(sIdx, { tempo: e.target.value })}
                  placeholder="3-1-1-0"
                />
              </FormField>
              <FormField label="RIR" hint="reps in reserve, 0-10">
                <NumberInput
                  min={0}
                  max={10}
                  step="0.5"
                  value={s.rir}
                  onChange={(e) => onUpdateSet(sIdx, { rir: e.target.value })}
                />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={s.is_warmup}
                onChange={(e) => onUpdateSet(sIdx, { is_warmup: e.target.checked })}
                className="h-4 w-4"
              />
              Warmup
            </label>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddSet}
          className="min-h-9 w-full rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
        >
          + Add set (copies last)
        </button>
      </div>
    </div>
  );
}
