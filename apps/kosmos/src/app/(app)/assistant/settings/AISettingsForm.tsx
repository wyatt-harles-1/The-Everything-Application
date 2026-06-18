"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { TextArea } from "@/components/forms/TextArea";
import { Select } from "@/components/forms/Select";
import { SubmitButton } from "@/components/forms/SubmitButton";

import type { FormActionState } from "@/lib/db/session";
import { SUPPORTED_PROVIDERS } from "@/lib/ai/providers";

type Action = (prev: FormActionState, fd: FormData) => Promise<FormActionState>;

export type AISettingsDefaults = {
  provider: string;
  model_id: string;
  use_managed_key: boolean;
  notes: string;
};

export function AISettingsForm({
  action,
  defaults,
  submitLabel,
  hasKey,
}: {
  action: Action;
  defaults: AISettingsDefaults;
  submitLabel: string;
  hasKey: boolean;
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

      <FormField label="Provider" htmlFor="provider" required>
        <Select
          id="provider"
          name="provider"
          required
          defaultValue={defaults.provider}
        >
          {SUPPORTED_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Model (optional)"
        htmlFor="model_id"
        hint="leave blank for provider default"
        error={errs?.model_id?.[0]}
      >
        <TextInput
          id="model_id"
          name="model_id"
          placeholder="claude-opus-4-7"
          defaultValue={defaults.model_id}
        />
      </FormField>

      <FormField
        label="API key"
        htmlFor="api_key"
        hint={
          hasKey
            ? "A key is on file. Leave blank to keep it; paste a new one to replace."
            : "Paste your provider key. Stored encrypted; never displayed back."
        }
        error={errs?.api_key?.[0]}
      >
        <input
          id="api_key"
          name="api_key"
          type="password"
          autoComplete="off"
          placeholder={hasKey ? "•••••• (key on file)" : "sk-ant-..."}
          className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
        />
      </FormField>

      <FormField label="Use the app's managed key instead">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="use_managed_key"
            defaultChecked={defaults.use_managed_key}
            className="h-5 w-5"
          />
          <span className="text-zinc-700 dark:text-zinc-300">
            Use the app&apos;s built-in key (if one is configured for the
            chosen provider in the deployment env)
          </span>
        </label>
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errs?.notes?.[0]}>
        <TextArea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes}
          placeholder="Optional"
        />
      </FormField>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
