"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import {
  scheduledEventDomains,
  scheduledEventTypes,
} from "@/lib/validation/scheduler";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type ScheduledEventFormDefaults = {
  domain?: string;
  event_type?: string;
  scheduled_for?: string;     // ISO datetime, local TZ format suitable for datetime-local input
  title?: string;
  notes?: string;
};

export function ScheduledEventForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: ScheduledEventFormDefaults;
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

  // Default: an hour from now, rounded to the nearest 15 min. Sensible
  // default for the "Quick add" use case.
  const defaultWhen = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
    // datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time, no TZ.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

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

      <FormField label="Title" htmlFor="title" required error={errs?.title?.[0]}>
        <TextInput
          id="title"
          name="title"
          required
          placeholder="Lifting session, dinner, dentist…"
          autoCapitalize="sentences"
          key={`t-${submitted ? "s" : "i"}`}
          defaultValue={pick("title", defaults.title)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Domain"
          htmlFor="domain"
          required
          error={errs?.domain?.[0]}
        >
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
          label="Type"
          htmlFor="event_type"
          required
          error={errs?.event_type?.[0]}
        >
          <Select
            id="event_type"
            name="event_type"
            required
            key={`et-${submitted ? "s" : "i"}`}
            defaultValue={pick("event_type", defaults.event_type ?? "workout")}
          >
            {scheduledEventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        label="When"
        htmlFor="scheduled_for"
        required
        error={errs?.scheduled_for?.[0]}
      >
        <input
          id="scheduled_for"
          name="scheduled_for"
          type="datetime-local"
          required
          key={`sf-${submitted ? "s" : "i"}`}
          defaultValue={pick("scheduled_for", defaults.scheduled_for ?? defaultWhen)}
          className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Optional"
          key={`n-${submitted ? "s" : "i"}`}
          defaultValue={pick("notes", defaults.notes)}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
