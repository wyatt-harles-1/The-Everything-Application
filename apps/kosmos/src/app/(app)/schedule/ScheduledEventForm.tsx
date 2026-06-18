"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import {
  scheduledEventDomains,
  scheduledEventTypes,
  recurrenceFreqs,
} from "@/lib/validation/scheduler";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type ScheduledEventFormDefaults = {
  domain?: string;
  event_type?: string;
  scheduled_for?: string;     // ISO datetime, local TZ format suitable for datetime-local input
  title?: string;
  notes?: string;
  // Recurrence defaults (used in edit mode when this is a series template)
  recurrence_freq?: string;
  recurrence_days?: number[];
  recurrence_until?: string;  // YYYY-MM-DD
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

  // Recurrence state. Initially open if editing a series template (i.e.,
  // defaults carry a recurrence_freq). The action layer reshapes these
  // flat FormData fields into the recurrence_rule JSON object.
  const initiallyRecurring = !!defaults.recurrence_freq;
  const [repeats, setRepeats] = useState(initiallyRecurring);
  const [freq, setFreq] = useState<string>(
    defaults.recurrence_freq ?? "weekly",
  );
  const [days, setDays] = useState<Set<number>>(
    new Set(defaults.recurrence_days ?? []),
  );
  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

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

      {/* Repeats section. Off by default; toggling on reveals the
          frequency / days / until sub-fields. The action reshapes these
          flat fields into the JSON recurrence_rule. */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="repeats"
            checked={repeats}
            onChange={(e) => setRepeats(e.target.checked)}
            className="h-5 w-5"
          />
          <span className="font-medium">Repeats</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            (creates a recurring series; instances are pre-generated for the
            next 90 days)
          </span>
        </label>

        {repeats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Frequency" htmlFor="recurrence_freq">
                <Select
                  id="recurrence_freq"
                  name="recurrence_freq"
                  value={freq}
                  onChange={(e) => setFreq(e.target.value)}
                >
                  {recurrenceFreqs.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Ends on (optional)"
                htmlFor="recurrence_until"
                hint="leave blank for no end"
              >
                <input
                  id="recurrence_until"
                  name="recurrence_until"
                  type="date"
                  defaultValue={defaults.recurrence_until ?? ""}
                  className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
                />
              </FormField>
            </div>

            {freq === "weekly" ? (
              <FormField label="Days of week">
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
                          name="recurrence_days"
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
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Leave blank to repeat on the same weekday as the start
                  date.
                </p>
              </FormField>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
