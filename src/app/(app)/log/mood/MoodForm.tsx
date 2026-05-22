"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextArea } from "@/components/forms/TextArea";
import { DateTimePicker } from "@/components/forms/DateTimePicker";
import { RatingScale } from "@/components/forms/RatingScale";
import { TagInput } from "@/components/forms/TagInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (
  prev: FormActionState,
  fd: FormData,
) => Promise<FormActionState>;

export type MoodFormDefaults = {
  occurred_at?: string;
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  anxiety?: number | null;
  notes?: string;
  tags?: string[];
};

export function MoodForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: MoodFormDefaults;
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
        label="When"
        htmlFor="occurred_at"
        required
        error={errs?.occurred_at?.[0]}
      >
        <DateTimePicker
          id="occurred_at"
          name="occurred_at"
          required
          defaultValue={defaults.occurred_at}
        />
      </FormField>

      <FormField label="Mood" hint="1 = awful, 10 = great" required error={errs?.mood?.[0]}>
        <RatingScale name="mood" required defaultValue={defaults.mood ?? undefined} />
      </FormField>

      <FormField label="Energy" hint="optional" error={errs?.energy?.[0]}>
        <RatingScale name="energy" defaultValue={defaults.energy ?? undefined} />
      </FormField>

      <FormField label="Stress" hint="optional" error={errs?.stress?.[0]}>
        <RatingScale name="stress" defaultValue={defaults.stress ?? undefined} />
      </FormField>

      <FormField label="Anxiety" hint="optional" error={errs?.anxiety?.[0]}>
        <RatingScale name="anxiety" defaultValue={defaults.anxiety ?? undefined} />
      </FormField>

      <FormField label="Tags" hint="enter to add" error={errs?.tags?.[0]}>
        <TagInput
          name="tags"
          defaultValue={defaults.tags}
          placeholder="post-workout, morning, …"
        />
      </FormField>

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
