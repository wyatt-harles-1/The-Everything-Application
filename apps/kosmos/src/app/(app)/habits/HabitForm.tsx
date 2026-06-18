"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import {
  scheduledEventDomains,
  scheduledEventTypes,
} from "@/lib/validation/scheduler";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type HabitFormDefaults = {
  name?: string;
  domain?: string;
  event_type?: string;
  target_frequency_per_week?: number | null;
  started_at?: string;        // YYYY-MM-DD
  notes?: string;
};

export function HabitForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: HabitFormDefaults;
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
          placeholder="Lift 3x/week, meditate daily, journal nightly…"
          autoCapitalize="sentences"
          key={`n-${submitted ? "s" : "i"}`}
          defaultValue={pick("name", defaults.name)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Domain" htmlFor="domain" required error={errs?.domain?.[0]}>
          <Select
            id="domain"
            name="domain"
            required
            key={`d-${submitted ? "s" : "i"}`}
            defaultValue={pick("domain", defaults.domain ?? "wellness")}
          >
            {scheduledEventDomains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Event type filter"
          htmlFor="event_type"
          hint="optional - leave blank for any"
          error={errs?.event_type?.[0]}
        >
          <Select
            id="event_type"
            name="event_type"
            key={`et-${submitted ? "s" : "i"}`}
            defaultValue={pick("event_type", defaults.event_type ?? "")}
          >
            <option value="">— any —</option>
            {scheduledEventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Target / week"
          htmlFor="target_frequency_per_week"
          required
          hint="7 = daily"
          error={errs?.target_frequency_per_week?.[0]}
        >
          <NumberInput
            id="target_frequency_per_week"
            name="target_frequency_per_week"
            inputMode="numeric"
            min={1}
            max={14}
            step={1}
            required
            key={`tf-${submitted ? "s" : "i"}`}
            defaultValue={
              submitted?.target_frequency_per_week ??
              (defaults.target_frequency_per_week != null
                ? String(defaults.target_frequency_per_week)
                : "3")
            }
          />
        </FormField>
        <FormField
          label="Started on"
          htmlFor="started_at"
          required
          hint="earlier = credits past events"
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
      </div>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Optional"
          key={`nt-${submitted ? "s" : "i"}`}
          defaultValue={pick("notes", defaults.notes)}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
