"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type LiftingRulesFormDefaults = {
  frequency_per_week?: number;
  preferred_days?: number[];
  default_time?: string;
  skip_deload?: boolean;
  notes?: string;
};

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

export function LiftingRulesForm({
  action,
  defaults,
  submitLabel,
}: {
  action: Action;
  defaults: LiftingRulesFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(
    action,
    null,
  );
  const errs = state && state.ok === false ? state.errors : undefined;

  const [days, setDays] = useState<Set<number>>(
    new Set(defaults.preferred_days ?? []),
  );
  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
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

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Sessions / week"
          htmlFor="frequency_per_week"
          required
          hint="0 to disable suggestions"
          error={errs?.frequency_per_week?.[0]}
        >
          <NumberInput
            id="frequency_per_week"
            name="frequency_per_week"
            inputMode="numeric"
            min={0}
            max={7}
            step={1}
            required
            defaultValue={String(defaults.frequency_per_week ?? 3)}
          />
        </FormField>
        <FormField
          label="Default time"
          htmlFor="default_time"
          required
          hint="24h, e.g. 17:00"
          error={errs?.default_time?.[0]}
        >
          <TextInput
            id="default_time"
            name="default_time"
            required
            defaultValue={defaults.default_time ?? "17:00"}
            pattern="^[0-9]{2}:[0-9]{2}$"
            placeholder="17:00"
          />
        </FormField>
      </div>

      <FormField
        label="Preferred days"
        hint="leave all unchecked for an auto-spaced pattern"
      >
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => {
            const on = days.has(d.value);
            return (
              <label
                key={d.value}
                className={`flex h-10 w-12 cursor-pointer items-center justify-center rounded-md border text-xs font-medium ${
                  on
                    ? "border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                    : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <input
                  type="checkbox"
                  name="preferred_days"
                  value={d.value}
                  checked={on}
                  onChange={() => toggleDay(d.value)}
                  className="sr-only"
                />
                {d.label}
              </label>
            );
          })}
        </div>
      </FormField>

      <FormField label="Skip deload weeks">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="skip_deload"
            defaultChecked={defaults.skip_deload ?? false}
            className="h-5 w-5"
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            Don&apos;t suggest sessions during the active mesocycle&apos;s
            deload week
          </span>
        </label>
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes ?? ""}
          placeholder="Free-text. Future agent reads these too."
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
