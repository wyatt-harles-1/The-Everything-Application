"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { DatePicker } from "@/components/forms/DatePicker";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type MedicationFormDefaults = {
  name?: string;
  dosage?: string;
  frequency?: string;
  started_on?: string;       // "YYYY-MM-DD"
  ended_on?: string;
  prescribing_doctor?: string;
  purpose?: string;
  notes?: string;
};

export function MedicationForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: MedicationFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(action, null);
  const errs = state && state.ok === false ? state.errors : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && state.ok === false && state.banner ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {state.banner}
        </div>
      ) : null}

      <FormField label="Name" htmlFor="name" required error={errs?.name?.[0]}>
        <TextInput id="name" name="name" required placeholder="Vitamin D" defaultValue={defaults.name} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Dosage" htmlFor="dosage" error={errs?.dosage?.[0]}>
          <TextInput id="dosage" name="dosage" placeholder="2000 IU" defaultValue={defaults.dosage} />
        </FormField>
        <FormField label="Frequency" htmlFor="frequency" error={errs?.frequency?.[0]}>
          <TextInput id="frequency" name="frequency" placeholder="daily, as needed" defaultValue={defaults.frequency} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Started on" htmlFor="started_on" error={errs?.started_on?.[0]}>
          <DatePicker id="started_on" name="started_on" defaultValue={defaults.started_on} />
        </FormField>
        <FormField label="Ended on" hint="leave blank if active" htmlFor="ended_on" error={errs?.ended_on?.[0]}>
          <DatePicker id="ended_on" name="ended_on" defaultValue={defaults.ended_on} />
        </FormField>
      </div>

      <FormField label="Prescribing doctor" htmlFor="prescribing_doctor" error={errs?.prescribing_doctor?.[0]}>
        <TextInput id="prescribing_doctor" name="prescribing_doctor" defaultValue={defaults.prescribing_doctor} />
      </FormField>

      <FormField label="Purpose" htmlFor="purpose" error={errs?.purpose?.[0]}>
        <TextInput id="purpose" name="purpose" placeholder="What is it for?" defaultValue={defaults.purpose} />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
