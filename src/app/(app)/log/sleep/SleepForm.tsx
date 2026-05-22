"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { DateTimePicker } from "@/components/forms/DateTimePicker";
import { RatingScale } from "@/components/forms/RatingScale";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (
  prev: FormActionState,
  fd: FormData,
) => Promise<FormActionState>;

export type SleepFormDefaults = {
  start_at?: string;
  end_at?: string;
  quality?: number | null;
  interruptions?: number | null;
  dreams_notes?: string;
  notes?: string;
};

export function SleepForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: SleepFormDefaults;
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
        label="Slept from"
        htmlFor="start_at"
        required
        error={errs?.start_at?.[0]}
      >
        <DateTimePicker
          id="start_at"
          name="start_at"
          required
          defaultValue={defaults.start_at}
        />
      </FormField>

      <FormField
        label="Woke at"
        htmlFor="end_at"
        required
        error={errs?.end_at?.[0]}
      >
        <DateTimePicker
          id="end_at"
          name="end_at"
          required
          defaultValue={defaults.end_at}
        />
      </FormField>

      <FormField label="Quality" hint="1 = terrible, 10 = great" error={errs?.quality?.[0]}>
        <RatingScale name="quality" min={1} max={10} defaultValue={defaults.quality ?? undefined} />
      </FormField>

      <FormField
        label="Interruptions"
        htmlFor="interruptions"
        hint="How many times did you wake up?"
        error={errs?.interruptions?.[0]}
      >
        <NumberInput
          id="interruptions"
          name="interruptions"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={defaults.interruptions ?? ""}
        />
      </FormField>

      <FormField label="Dreams" htmlFor="dreams_notes" error={errs?.dreams_notes?.[0]}>
        <TextArea
          id="dreams_notes"
          name="dreams_notes"
          rows={3}
          defaultValue={defaults.dreams_notes}
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
