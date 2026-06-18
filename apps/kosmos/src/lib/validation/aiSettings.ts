// Validation for /assistant/settings. The form posts provider, model,
// optionally api_key (write-only), and use_managed_key. The action
// encrypts api_key before writing.

import { z } from "zod";

import { SUPPORTED_PROVIDERS } from "../ai/providers";

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

export const aiSettingsSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  // Bounded: the DB column is free text (new models ship without a migration),
  // but a model id is short — cap it so an oversized string can't be stored.
  model_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().max(100).optional(),
  ),
  // Write-only: the form leaves this blank when the user doesn't want
  // to change the stored key. Empty string -> undefined -> no update.
  api_key: optionalText,
  use_managed_key: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean(),
  ),
  notes: optionalText,
});

export type AISettingsInput = z.infer<typeof aiSettingsSchema>;
