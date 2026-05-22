"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { DateTimePicker } from "@/components/forms/DateTimePicker";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type BodyFormDefaults = {
  measured_at?: string;
  weight_lbs?: number | null;
  body_fat_pct?: number | null;
  skeletal_muscle_lbs?: number | null;
  waist_in?: number | null;
  chest_in?: number | null;
  arm_in?: number | null;
  thigh_in?: number | null;
  notes?: string;
};

export function BodyForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: BodyFormDefaults;
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

      <FormField label="When" htmlFor="measured_at" required error={errs?.measured_at?.[0]}>
        <DateTimePicker id="measured_at" name="measured_at" required defaultValue={defaults.measured_at} />
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Scale</legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Weight (lbs)" htmlFor="weight_lbs" error={errs?.weight_lbs?.[0]}>
            <NumberInput id="weight_lbs" name="weight_lbs" min={0} step="0.1" defaultValue={defaults.weight_lbs ?? ""} />
          </FormField>
          <FormField label="Body fat %" htmlFor="body_fat_pct" error={errs?.body_fat_pct?.[0]}>
            <NumberInput id="body_fat_pct" name="body_fat_pct" min={0} max={100} step="0.1" defaultValue={defaults.body_fat_pct ?? ""} />
          </FormField>
          <FormField label="Skeletal muscle (lbs)" htmlFor="skeletal_muscle_lbs" error={errs?.skeletal_muscle_lbs?.[0]}>
            <NumberInput id="skeletal_muscle_lbs" name="skeletal_muscle_lbs" min={0} step="0.1" defaultValue={defaults.skeletal_muscle_lbs ?? ""} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Tape (inches)</legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Waist" htmlFor="waist_in" error={errs?.waist_in?.[0]}>
            <NumberInput id="waist_in" name="waist_in" min={0} step="0.1" defaultValue={defaults.waist_in ?? ""} />
          </FormField>
          <FormField label="Chest" htmlFor="chest_in" error={errs?.chest_in?.[0]}>
            <NumberInput id="chest_in" name="chest_in" min={0} step="0.1" defaultValue={defaults.chest_in ?? ""} />
          </FormField>
          <FormField label="Arm" htmlFor="arm_in" error={errs?.arm_in?.[0]}>
            <NumberInput id="arm_in" name="arm_in" min={0} step="0.1" defaultValue={defaults.arm_in ?? ""} />
          </FormField>
          <FormField label="Thigh" htmlFor="thigh_in" error={errs?.thigh_in?.[0]}>
            <NumberInput id="thigh_in" name="thigh_in" min={0} step="0.1" defaultValue={defaults.thigh_in ?? ""} />
          </FormField>
        </div>
      </fieldset>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
