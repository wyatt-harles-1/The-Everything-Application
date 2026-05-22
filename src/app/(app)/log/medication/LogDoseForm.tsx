// Compact form embedded on /log/medication to log a dose. Picks from the
// user's active medications (passed in as a prop from the Server Component
// page). Defaults "taken at" to the time the form mounts.

"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { Select } from "@/components/forms/Select";
import { DateTimePicker } from "@/components/forms/DateTimePicker";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";

import { logDose } from "./actions";

type MedOption = { id: string; name: string; dosage: string | null };

export function LogDoseForm({ medications }: { medications: MedOption[] }) {
  const [state, formAction] = useActionState<FormActionState, FormData>(logDose, null);
  const errs = state && state.ok === false ? state.errors : undefined;

  // Track the picked med so we can auto-fill the dose default with its
  // configured dosage.
  const [pickedId, setPickedId] = useState<string>(medications[0]?.id ?? "");
  const picked = medications.find((m) => m.id === pickedId);

  if (medications.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Add a medication first, then come back to log a dose.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && state.ok === false && state.banner ? (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          {state.banner}
        </div>
      ) : null}

      <FormField label="Medication" htmlFor="medication_id" required error={errs?.medication_id?.[0]}>
        <Select
          id="medication_id"
          name="medication_id"
          required
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
        >
          {medications.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}{m.dosage ? ` (${m.dosage})` : ""}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Taken at" htmlFor="taken_at" required error={errs?.taken_at?.[0]}>
          <DateTimePicker id="taken_at" name="taken_at" required />
        </FormField>
        <FormField label="Dose taken" htmlFor="dose_taken" hint={picked?.dosage ? `default: ${picked.dosage}` : undefined} error={errs?.dose_taken?.[0]}>
          {/* `key` makes the input re-render with a new defaultValue when the
              user picks a different med - otherwise React keeps the stale one. */}
          <TextInput
            key={pickedId}
            id="dose_taken"
            name="dose_taken"
            defaultValue={picked?.dosage ?? ""}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="skipped" className="h-4 w-4" />
        Skipped (didn&apos;t take it)
      </label>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextInput id="notes" name="notes" placeholder="Optional" />
      </FormField>

      <SubmitButton pendingLabel="Logging…">Log dose</SubmitButton>
    </form>
  );
}
