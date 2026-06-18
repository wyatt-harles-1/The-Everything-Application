"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type MesocycleFormDefaults = {
  name?: string;
  started_at?: string;             // ISO YYYY-MM-DD
  planned_weeks?: number | null;
  deload_week_number?: number | null;
  notes?: string;
};

export function MesocycleForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: MesocycleFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(
    action,
    null,
  );
  const errs = state && state.ok === false ? state.errors : undefined;
  const submitted = state && state.ok === false ? state.values : undefined;
  const pick = (name: string, fallback?: string) =>
    submitted?.[name] ?? fallback ?? "";

  // Today as YYYY-MM-DD for the date picker's sensible default on create.
  const today = new Date().toISOString().slice(0, 10);

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

      <FormField label="Name" htmlFor="name" required error={errs?.name?.[0]}>
        <TextInput
          id="name"
          name="name"
          required
          placeholder="May Hypertrophy Block 1"
          autoCapitalize="words"
          key={`name-${submitted ? "s" : "i"}`}
          defaultValue={pick("name", defaults.name)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Start date"
          htmlFor="started_at"
          required
          error={errs?.started_at?.[0]}
        >
          <input
            id="started_at"
            name="started_at"
            type="date"
            required
            key={`sd-${submitted ? "s" : "i"}`}
            defaultValue={pick("started_at", defaults.started_at ?? today)}
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
          />
        </FormField>
        <FormField
          label="Planned weeks"
          htmlFor="planned_weeks"
          required
          hint="typical: 4-6"
          error={errs?.planned_weeks?.[0]}
        >
          <NumberInput
            id="planned_weeks"
            name="planned_weeks"
            inputMode="numeric"
            min={1}
            max={26}
            step={1}
            required
            key={`pw-${submitted ? "s" : "i"}`}
            defaultValue={
              submitted?.planned_weeks ??
              (defaults.planned_weeks != null
                ? String(defaults.planned_weeks)
                : "5")
            }
          />
        </FormField>
      </div>

      <FormField
        label="Deload week (optional)"
        htmlFor="deload_week_number"
        hint="1-indexed. Usually the last week."
        error={errs?.deload_week_number?.[0]}
      >
        <NumberInput
          id="deload_week_number"
          name="deload_week_number"
          inputMode="numeric"
          min={1}
          max={26}
          step={1}
          key={`dw-${submitted ? "s" : "i"}`}
          defaultValue={
            submitted?.deload_week_number ??
            (defaults.deload_week_number != null
              ? String(defaults.deload_week_number)
              : "")
          }
          placeholder="leave blank for none"
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Block focus, progression scheme, etc."
          key={`n-${submitted ? "s" : "i"}`}
          defaultValue={pick("notes", defaults.notes)}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
