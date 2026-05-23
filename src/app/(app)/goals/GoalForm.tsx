"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import { scheduledEventDomains } from "@/lib/validation/scheduler";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type GoalFormDefaults = {
  title?: string;
  description?: string;
  domain?: string;
  category?: string;
  target_metric?: string;
  target_value?: number | null;
  target_date?: string;     // YYYY-MM-DD
  priority?: number;
};

export function GoalForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: GoalFormDefaults;
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
          placeholder="Bench 315 lbs, run a sub-25 5K, save $20k…"
          autoCapitalize="sentences"
          key={`t-${submitted ? "s" : "i"}`}
          defaultValue={pick("title", defaults.title)}
        />
      </FormField>

      <FormField label="Description" htmlFor="description" error={errs?.description?.[0]}>
        <TextArea
          id="description"
          name="description"
          rows={2}
          placeholder="Why does this matter to you?"
          key={`d-${submitted ? "s" : "i"}`}
          defaultValue={pick("description", defaults.description)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Domain" htmlFor="domain" required error={errs?.domain?.[0]}>
          <Select
            id="domain"
            name="domain"
            required
            key={`dom-${submitted ? "s" : "i"}`}
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
          label="Category"
          htmlFor="category"
          hint="optional, free text"
          error={errs?.category?.[0]}
        >
          <TextInput
            id="category"
            name="category"
            placeholder="strength, endurance, savings…"
            key={`c-${submitted ? "s" : "i"}`}
            defaultValue={pick("category", defaults.category)}
          />
        </FormField>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Quantitative target (optional)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Metric"
            htmlFor="target_metric"
            hint="what you're measuring"
            error={errs?.target_metric?.[0]}
          >
            <TextInput
              id="target_metric"
              name="target_metric"
              placeholder="bench_e1rm_lbs, 5k_time_sec, total_saved_usd…"
              key={`tm-${submitted ? "s" : "i"}`}
              defaultValue={pick("target_metric", defaults.target_metric)}
            />
          </FormField>
          <FormField
            label="Target value"
            htmlFor="target_value"
            error={errs?.target_value?.[0]}
          >
            <NumberInput
              id="target_value"
              name="target_value"
              inputMode="decimal"
              step="any"
              key={`tv-${submitted ? "s" : "i"}`}
              defaultValue={
                submitted?.target_value ??
                (defaults.target_value != null
                  ? String(defaults.target_value)
                  : "")
              }
              placeholder="315"
            />
          </FormField>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Target date"
          htmlFor="target_date"
          hint="optional deadline"
          error={errs?.target_date?.[0]}
        >
          <input
            id="target_date"
            name="target_date"
            type="date"
            key={`td-${submitted ? "s" : "i"}`}
            defaultValue={pick("target_date", defaults.target_date)}
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
          />
        </FormField>
        <FormField
          label="Priority"
          htmlFor="priority"
          required
          hint="1=highest, 5=lowest"
          error={errs?.priority?.[0]}
        >
          <NumberInput
            id="priority"
            name="priority"
            inputMode="numeric"
            min={1}
            max={5}
            step={1}
            required
            key={`p-${submitted ? "s" : "i"}`}
            defaultValue={
              submitted?.priority ?? String(defaults.priority ?? 3)
            }
          />
        </FormField>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
