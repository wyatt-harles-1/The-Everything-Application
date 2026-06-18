"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type ShoeFormDefaults = {
  name?: string;
  brand?: string;
  model?: string;
  retire_at_miles?: number | null;
  started_at?: string;
  retired_at?: string;
  notes?: string;
};

export function ShoeForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: ShoeFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(
    action,
    null,
  );
  const errs = state && state.ok === false ? state.errors : undefined;
  const submitted = state && state.ok === false ? state.values : undefined;
  const pick = (n: string, fb?: string) => submitted?.[n] ?? fb ?? "";

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
          placeholder="Daily Endorphins, Trail Peregrines…"
          key={`n-${submitted ? "s" : "i"}`}
          defaultValue={pick("name", defaults.name)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Brand" htmlFor="brand" error={errs?.brand?.[0]}>
          <TextInput
            id="brand"
            name="brand"
            placeholder="Saucony"
            key={`b-${submitted ? "s" : "i"}`}
            defaultValue={pick("brand", defaults.brand)}
          />
        </FormField>
        <FormField label="Model" htmlFor="model" error={errs?.model?.[0]}>
          <TextInput
            id="model"
            name="model"
            placeholder="Endorphin Speed 4"
            key={`m-${submitted ? "s" : "i"}`}
            defaultValue={pick("model", defaults.model)}
          />
        </FormField>
      </div>

      <FormField
        label="Retire at (mi)"
        htmlFor="retire_at_miles"
        hint="optional; 300-500 is typical for road shoes"
        error={errs?.retire_at_miles?.[0]}
      >
        <NumberInput
          id="retire_at_miles"
          name="retire_at_miles"
          inputMode="decimal"
          min={0}
          step={5}
          key={`r-${submitted ? "s" : "i"}`}
          defaultValue={
            submitted?.retire_at_miles ??
            (defaults.retire_at_miles != null
              ? String(defaults.retire_at_miles)
              : "")
          }
          placeholder="400"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Started"
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
          label="Retired"
          htmlFor="retired_at"
          hint="leave blank if active"
          error={errs?.retired_at?.[0]}
        >
          <input
            id="retired_at"
            name="retired_at"
            type="date"
            key={`rd-${submitted ? "s" : "i"}`}
            defaultValue={pick("retired_at", defaults.retired_at ?? "")}
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
          />
        </FormField>
      </div>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          key={`nt-${submitted ? "s" : "i"}`}
          defaultValue={pick("notes", defaults.notes)}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
