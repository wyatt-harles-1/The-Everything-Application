// Validation for shared.scheduled_events. Lives in its own file (rather
// than wellness.ts) because the scheduler is a shared-domain concept that
// every module touches - keeping the validators colocated with the schema
// they validate makes the next module's validators easier to add.

import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

// Domains allowed by the CHECK constraint on shared.scheduled_events.domain.
// Keep in sync if the constraint ever changes.
export const scheduledEventDomains = [
  "wellness",
  "productivity",
  "finance",
  "knowledge",
  "shared",
] as const;

// Common event_type values shown in the form's dropdown. The DB column is
// free text on purpose - new event_types can be added without a migration -
// but the form constrains to a known list for now to keep the UI tractable.
export const scheduledEventTypes = [
  "workout",         // lifting / cardio session
  "meal",            // planned meal
  "sleep",           // planned bedtime
  "meditation",      // mobility / mindfulness
  "appointment",     // doctor, etc.
  "habit",           // generic recurring habit
  "task",            // one-off productivity task
  "other",
] as const;

export const scheduledEventSchema = z.object({
  domain: z.enum(scheduledEventDomains),
  event_type: z.enum(scheduledEventTypes),
  scheduled_for: z.coerce.date(),
  title: z.string().trim().min(1, "Title is required"),
  notes: optionalText,
});

export type ScheduledEventInput = z.infer<typeof scheduledEventSchema>;
