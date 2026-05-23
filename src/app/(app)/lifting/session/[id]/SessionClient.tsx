// Gym-mode live session UI. One column, sticky header (workout title +
// elapsed time), sticky footer (Finish workout). Each exercise is a card
// with its sets as rows; rows are inline-editable with a big Complete
// button on the right. A rest timer overlays the screen briefly after
// each completed set, counting down from the exercise's planned rest
// (or 90s default).
//
// Auto-save shape: editing a value fires updateSetValues on blur;
// tapping Complete fires toggleSetComplete. Both are small targeted
// updates; if the network drops a single set's data is the most that
// could go missing.

"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  updateSetValues,
  toggleSetComplete,
  deleteSet,
  addSetForExercise,
  addExerciseToSession,
  finishSession,
} from "../actions";

export type SessionSet = {
  id: string;
  setNumber: number;
  reps: number | null;
  weightLbs: number | null;
  rpe: number | null;
  e1rmLbs: number | null;
  isWarmup: boolean;
  completedAt: string | null;
  // True when this set's e1RM ties or beats the user's all-time best for
  // the exercise. Computed server-side at render; optimistic UI in this
  // file doesn't try to recompute - the next router.refresh() picks it up.
  isPR: boolean;
};

export type SessionExercise = {
  key: string;
  exerciseId: string | null;
  name: string;
  lastPerformance: {
    reps: number | null;
    weightLbs: number | null;
    completedAt: string;
  } | null;
  sets: SessionSet[];
};

const DEFAULT_REST_SECONDS = 90;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function SessionClient({
  workoutId,
  startedAt,
  endedAt,
  title,
  exercises: initialExercises,
  exerciseNames,
}: {
  workoutId: string;
  startedAt: string;
  endedAt: string | null;
  title: string | null;
  exercises: SessionExercise[];
  exerciseNames: string[];
}) {
  const [exercises, setExercises] = useState<SessionExercise[]>(initialExercises);
  const [elapsed, setElapsed] = useState<number>(() =>
    Date.now() - new Date(startedAt).getTime(),
  );
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [isFinishing, startFinishTransition] = useTransition();
  const router = useRouter();

  const isLive = endedAt === null;

  // Elapsed-time ticker (updates every second when the session is live).
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - new Date(startedAt).getTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isLive]);

  // Rest-timer countdown. Pauses to NULL when expires.
  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      setRestRemaining(null);
      return;
    }
    const t = setTimeout(() => setRestRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [restRemaining]);

  // ---- mutations (optimistic UI, then fire Server Action) ----------------

  function patchSet(setId: string, patch: Partial<SessionSet>) {
    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      })),
    );
  }

  function onSetFieldBlur(
    setId: string,
    field: "reps" | "weight_lbs" | "rpe",
    rawValue: string,
  ) {
    // Persist what was typed. Empty string -> null on the server side.
    updateSetValues(setId, { [field]: rawValue }).catch(console.error);
  }

  function onToggleComplete(set: SessionSet, exerciseKey: string) {
    const nowComplete = !set.completedAt;
    patchSet(set.id, {
      completedAt: nowComplete ? new Date().toISOString() : null,
    });
    toggleSetComplete(set.id, nowComplete).catch(console.error);
    if (nowComplete && !set.isWarmup) {
      setRestRemaining(DEFAULT_REST_SECONDS);
    }
    // Reference the key so the lint rule about unused params is satisfied
    // and so future per-exercise rest_seconds can plug in here.
    void exerciseKey;
  }

  function onAddSet(ex: SessionExercise) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lastSet = ex.sets[ex.sets.length - 1];
    setExercises((prev) =>
      prev.map((e) =>
        e.key === ex.key
          ? {
              ...e,
              sets: [
                ...e.sets,
                {
                  id: tempId,
                  setNumber: (lastSet?.setNumber ?? 0) + 1,
                  reps: lastSet?.reps ?? null,
                  weightLbs: lastSet?.weightLbs ?? null,
                  rpe: null,
                  e1rmLbs: null,
                  isWarmup: false,
                  completedAt: null,
                  isPR: false,
                },
              ],
            }
          : e,
      ),
    );
    addSetForExercise(workoutId, {
      id: ex.exerciseId,
      name: ex.name,
    }).then(() => {
      // Refresh to pick up the real id from the DB (server-side render
      // returns the persisted id; optimistic temp id is just for the
      // moments before).
      router.refresh();
    }).catch(console.error);
  }

  function onRemoveSet(setId: string) {
    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.id !== setId),
      })),
    );
    deleteSet(setId).catch(console.error);
  }

  function onAddExercise() {
    const name = newExerciseName.trim();
    if (!name) return;
    setNewExerciseName("");
    addExerciseToSession(workoutId, name)
      .then(() => router.refresh())
      .catch(console.error);
  }

  function onFinish() {
    if (!confirm("Finish this session?")) return;
    startFinishTransition(() => {
      finishSession(workoutId).catch(console.error);
    });
  }

  // ---- render --------------------------------------------------------------

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-my-8">
      {/* Header */}
      <header className="sticky top-14 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Link
              href="/lifting"
              className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              ← Lifting
            </Link>
            <h1 className="text-base font-semibold">{title ?? "Session"}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isLive ? "elapsed" : "ended"}
            </p>
            <p className="font-mono text-base font-medium">{formatElapsed(elapsed)}</p>
          </div>
        </div>
      </header>

      {/* Rest timer overlay - small banner at the top of the scroll area */}
      {restRemaining !== null ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-900 dark:bg-emerald-950">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              Rest {restRemaining}s
            </span>
            <button
              type="button"
              onClick={() => setRestRemaining(null)}
              className="text-xs font-medium text-emerald-900 underline underline-offset-4 hover:text-emerald-700 dark:text-emerald-100 dark:hover:text-emerald-300"
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}

      {/* Exercise list (scrollable) */}
      <div className="flex-1 space-y-4 px-4 py-4">
        {exercises.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No exercises yet. Add one below to start.
          </p>
        ) : null}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.key}
            exercise={ex}
            onUpdateField={onSetFieldBlur}
            onToggleComplete={(s) => onToggleComplete(s, ex.key)}
            onAddSet={() => onAddSet(ex)}
            onRemoveSet={onRemoveSet}
            patchSet={patchSet}
          />
        ))}

        <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Add exercise
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              placeholder="Back Squat"
              list="exercise-library-names"
              autoCapitalize="words"
              className="min-h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
            />
            <button
              type="button"
              onClick={onAddExercise}
              disabled={!newExerciseName.trim()}
              className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Add
            </button>
          </div>
          {exerciseNames.length > 0 ? (
            <datalist id="exercise-library-names">
              {exerciseNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          ) : null}
        </div>
      </div>

      {/* Footer - sticky finish button. Hidden once the session is ended. */}
      {isLive ? (
        <footer className="sticky bottom-0 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <button
            type="button"
            onClick={onFinish}
            disabled={isFinishing}
            className="min-h-14 w-full rounded-lg bg-zinc-950 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {isFinishing ? "Finishing…" : "Finish session"}
          </button>
        </footer>
      ) : (
        <footer className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Session ended.{" "}
          <Link
            href={`/log/workout/${workoutId}`}
            className="underline underline-offset-4"
          >
            Open in editor
          </Link>
        </footer>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  onUpdateField,
  onToggleComplete,
  onAddSet,
  onRemoveSet,
  patchSet,
}: {
  exercise: SessionExercise;
  onUpdateField: (
    setId: string,
    field: "reps" | "weight_lbs" | "rpe",
    value: string,
  ) => void;
  onToggleComplete: (set: SessionSet) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  patchSet: (setId: string, patch: Partial<SessionSet>) => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{exercise.name}</h2>
        {exercise.lastPerformance ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            last {formatRelative(exercise.lastPerformance.completedAt)}:{" "}
            <span className="font-medium text-zinc-950 dark:text-zinc-50">
              {exercise.lastPerformance.weightLbs ?? "?"}×
              {exercise.lastPerformance.reps ?? "?"}
            </span>
          </span>
        ) : null}
      </header>

      <ul className="space-y-1.5">
        {exercise.sets.map((s) => (
          <SetRow
            key={s.id}
            set={s}
            onUpdateField={onUpdateField}
            onToggleComplete={() => onToggleComplete(s)}
            onRemove={() => onRemoveSet(s.id)}
            patchSet={patchSet}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onAddSet}
        className="min-h-10 w-full rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
      >
        + Add set
      </button>
    </section>
  );
}

function SetRow({
  set,
  onUpdateField,
  onToggleComplete,
  onRemove,
  patchSet,
}: {
  set: SessionSet;
  onUpdateField: (
    setId: string,
    field: "reps" | "weight_lbs" | "rpe",
    value: string,
  ) => void;
  onToggleComplete: () => void;
  onRemove: () => void;
  patchSet: (setId: string, patch: Partial<SessionSet>) => void;
}) {
  const done = !!set.completedAt;

  return (
    <li
      className={`flex items-center gap-2 rounded-md p-2 transition-colors ${
        done
          ? "bg-emerald-50 dark:bg-emerald-950/50"
          : "bg-zinc-50 dark:bg-zinc-900/40"
      }`}
    >
      <span className="w-12 shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {set.isWarmup ? "W" : set.setNumber}
        {set.isPR ? (
          <span className="ml-0.5 text-amber-600 dark:text-amber-300" aria-label="personal record">
            🏆
          </span>
        ) : null}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        defaultValue={set.reps ?? ""}
        onBlur={(e) => onUpdateField(set.id, "reps", e.target.value)}
        onChange={(e) =>
          patchSet(set.id, { reps: e.target.value === "" ? null : Number(e.target.value) })
        }
        aria-label="reps"
        className="min-h-10 w-14 rounded border border-zinc-300 bg-white px-1.5 text-center text-sm tabular-nums focus:border-zinc-950 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
      />
      <span className="text-xs text-zinc-400">×</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="2.5"
        defaultValue={set.weightLbs ?? ""}
        onBlur={(e) => onUpdateField(set.id, "weight_lbs", e.target.value)}
        onChange={(e) =>
          patchSet(set.id, { weightLbs: e.target.value === "" ? null : Number(e.target.value) })
        }
        aria-label="weight"
        className="min-h-10 w-20 rounded border border-zinc-300 bg-white px-1.5 text-center text-sm tabular-nums focus:border-zinc-950 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
      />
      <span className="text-xs text-zinc-400">@</span>
      <input
        type="number"
        inputMode="decimal"
        min={1}
        max={10}
        step="0.5"
        defaultValue={set.rpe ?? ""}
        onBlur={(e) => onUpdateField(set.id, "rpe", e.target.value)}
        onChange={(e) =>
          patchSet(set.id, { rpe: e.target.value === "" ? null : Number(e.target.value) })
        }
        aria-label="rpe"
        placeholder="rpe"
        className="min-h-10 w-12 rounded border border-zinc-300 bg-white px-1.5 text-center text-sm tabular-nums focus:border-zinc-950 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
      />
      <button
        type="button"
        onClick={onToggleComplete}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className={`ml-auto flex h-10 w-10 items-center justify-center rounded-md text-lg ${
          done
            ? "bg-emerald-600 text-white"
            : "border border-zinc-300 text-zinc-400 hover:border-zinc-500 hover:text-zinc-950 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
        }`}
      >
        {done ? "✓" : "○"}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove set"
        className="h-10 w-8 text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
      >
        ×
      </button>
    </li>
  );
}
