// Validation for shared.habits. Kept in its own file (rather than scheduler.ts)
// because habits are conceptually distinct - they describe an aspiration
// for behavior frequency rather than a single planned event.

import { z } from "zod";

import { scheduledEventDomains } from "./scheduler";

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

export const habitSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  domain: z.enum(scheduledEventDomains),
  // Optional event_type filter. Empty string -> undefined.
  event_type: optionalText,
  target_frequency_per_week: z.coerce
    .number()
    .int()
    .min(1, "Must be at least 1/week")
    .max(14, "Max 14/week"),
  started_at: z.coerce.date(),
  notes: optionalText,
});

export type HabitInput = z.infer<typeof habitSchema>;
