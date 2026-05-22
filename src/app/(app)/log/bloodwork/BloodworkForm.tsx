"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { NumberInput } from "@/components/forms/NumberInput";
import { Select } from "@/components/forms/Select";
import { DatePicker } from "@/components/forms/DatePicker";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import {
  bloodworkResultFlags,
  quickAddMarkers,
} from "@/lib/validation/wellness";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type ResultDraft = {
  marker_name: string;
  value: string;
  value_text: string;
  unit: string;
  reference_low: string;
  reference_high: string;
  flag: string;
  notes: string;
};

export type BloodworkFormDefaults = {
  drawn_at?: string;             // "YYYY-MM-DD"
  lab_name?: string;
  ordering_provider?: string;
  panel_type?: string;
  notes?: string;
  results?: ResultDraft[];
  existing_file_path?: string;   // displayed but not editable - upload a new one to replace
};

function emptyResult(): ResultDraft {
  return {
    marker_name: "",
    value: "",
    value_text: "",
    unit: "",
    reference_low: "",
    reference_high: "",
    flag: "",
    notes: "",
  };
}

export function BloodworkForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: Action;
  defaults?: BloodworkFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormActionState, FormData>(action, null);
  const errs = state && state.ok === false ? state.errors : undefined;
  // Values the user just submitted, captured by the Server Action so we
  // can re-hydrate inputs after a validation failure. Falls back to the
  // `defaults` prop (used by the edit page) when not present.
  const submitted = state && state.ok === false ? state.values : undefined;
  const pick = (name: string, fallback?: string) =>
    submitted?.[name] ?? fallback ?? "";

  const [results, setResults] = useState<ResultDraft[]>(
    defaults.results && defaults.results.length > 0
      ? defaults.results
      : [],
  );

  function updateResult(i: number, patch: Partial<ResultDraft>) {
    setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addResult(initial?: Partial<ResultDraft>) {
    setResults((prev) => [...prev, { ...emptyResult(), ...initial }]);
  }
  function removeResult(i: number) {
    setResults((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={formAction} className="space-y-5" noValidate encType="multipart/form-data">
      {state && state.ok === false && state.banner ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {state.banner}
        </div>
      ) : null}

      <FormField label="Drawn on" htmlFor="drawn_at" required error={errs?.drawn_at?.[0]}>
        {/* `key` forces a remount when the submitted value changes - <input>
            otherwise ignores defaultValue updates after first render. */}
        <DatePicker
          id="drawn_at"
          name="drawn_at"
          required
          key={`drawn_at-${submitted ? "s" : "i"}`}
          defaultValue={pick("drawn_at", defaults.drawn_at)}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Lab name" htmlFor="lab_name" error={errs?.lab_name?.[0]}>
          <TextInput
            id="lab_name"
            name="lab_name"
            placeholder="Quest, Labcorp …"
            key={`lab_name-${submitted ? "s" : "i"}`}
            defaultValue={pick("lab_name", defaults.lab_name)}
          />
        </FormField>
        <FormField label="Ordering provider" htmlFor="ordering_provider" error={errs?.ordering_provider?.[0]}>
          <TextInput
            id="ordering_provider"
            name="ordering_provider"
            key={`ordering_provider-${submitted ? "s" : "i"}`}
            defaultValue={pick("ordering_provider", defaults.ordering_provider)}
          />
        </FormField>
      </div>

      <FormField label="Panel type" htmlFor="panel_type" hint="annual, thyroid, hormone, lipid …" error={errs?.panel_type?.[0]}>
        <TextInput
          id="panel_type"
          name="panel_type"
          key={`panel_type-${submitted ? "s" : "i"}`}
          defaultValue={pick("panel_type", defaults.panel_type)}
        />
      </FormField>

      <FormField label="Lab report" htmlFor="file" hint="PDF or image; optional" error={errs?.file?.[0]}>
        {defaults.existing_file_path ? (
          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
            Existing file: <code>{defaults.existing_file_path}</code>. Upload a new one to replace.
          </p>
        ) : null}
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,image/*"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:hover:file:bg-zinc-700"
        />
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Markers</legend>

        <div className="space-y-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Quick add:</p>
          <div className="flex flex-wrap gap-1.5">
            {quickAddMarkers.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => addResult({ marker_name: m.name, unit: m.unit })}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
              >
                + {m.name}
              </button>
            ))}
          </div>
        </div>

        {results.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No markers added yet. Use a quick-add above, or click &quot;Add custom marker&quot; below.
          </p>
        ) : (
          results.map((r, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <FormField label="Marker">
                  <TextInput
                    value={r.marker_name}
                    onChange={(e) => updateResult(i, { marker_name: e.target.value })}
                    placeholder="TSH, LDL, …"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => removeResult(i)}
                  className="ml-3 mt-7 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  aria-label={`Remove ${r.marker_name || "marker"}`}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <FormField label="Value">
                  <NumberInput
                    step="any"
                    value={r.value}
                    onChange={(e) => updateResult(i, { value: e.target.value })}
                  />
                </FormField>
                <FormField label="Or text">
                  <TextInput
                    value={r.value_text}
                    onChange={(e) => updateResult(i, { value_text: e.target.value })}
                    placeholder="Negative, Detected …"
                  />
                </FormField>
                <FormField label="Unit">
                  <TextInput
                    value={r.unit}
                    onChange={(e) => updateResult(i, { unit: e.target.value })}
                    placeholder="mg/dL"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <FormField label="Ref low">
                  <NumberInput
                    step="any"
                    value={r.reference_low}
                    onChange={(e) => updateResult(i, { reference_low: e.target.value })}
                  />
                </FormField>
                <FormField label="Ref high">
                  <NumberInput
                    step="any"
                    value={r.reference_high}
                    onChange={(e) => updateResult(i, { reference_high: e.target.value })}
                  />
                </FormField>
                <FormField label="Flag">
                  <Select
                    value={r.flag}
                    onChange={(e) => updateResult(i, { flag: e.target.value })}
                  >
                    <option value="">—</option>
                    {bloodworkResultFlags.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <FormField label="Notes">
                <TextInput
                  value={r.notes}
                  onChange={(e) => updateResult(i, { notes: e.target.value })}
                  placeholder="Optional"
                />
              </FormField>
            </div>
          ))
        )}

        <button
          type="button"
          onClick={() => addResult()}
          className="min-h-11 w-full rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
        >
          + Add custom marker
        </button>

        <input type="hidden" name="results_json" value={JSON.stringify(results)} />
      </fieldset>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={3}
          key={`notes-${submitted ? "s" : "i"}`}
          defaultValue={pick("notes", defaults.notes)}
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
