"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextArea } from "@/components/forms/TextArea";
import { Select } from "@/components/forms/Select";
import { DatePicker } from "@/components/forms/DatePicker";
import { TagInput } from "@/components/forms/TagInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import { cyclePhases, cycleFlows } from "@/lib/validation/wellness";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type CycleFormDefaults = {
  occurred_at?: string;       // "YYYY-MM-DD"
  phase?: string;
  flow?: string;
  symptoms?: string[];
  notes?: string;
};

export function CycleForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: CycleFormDefaults;
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

      <FormField label="Date" htmlFor="occurred_at" required error={errs?.occurred_at?.[0]}>
        <DatePicker id="occurred_at" name="occurred_at" required defaultValue={defaults.occurred_at} />
      </FormField>

      <FormField label="Phase" htmlFor="phase" error={errs?.phase?.[0]}>
        <Select id="phase" name="phase" defaultValue={defaults.phase ?? ""}>
          <option value="">— select —</option>
          {cyclePhases.map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </Select>
      </FormField>

      <FormField label="Flow" htmlFor="flow" error={errs?.flow?.[0]}>
        <Select id="flow" name="flow" defaultValue={defaults.flow ?? ""}>
          <option value="">— select —</option>
          {cycleFlows.map((f) => (
            <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>
          ))}
        </Select>
      </FormField>

      <FormField label="Symptoms" hint="enter to add" error={errs?.symptoms?.[0]}>
        <TagInput
          name="symptoms"
          defaultValue={defaults.symptoms}
          placeholder="cramps, headache, …"
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
