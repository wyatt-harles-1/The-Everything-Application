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

export const recurrenceFreqs = ["daily", "weekly", "monthly"] as const;

// JSON shape persisted on shared.scheduled_events.recurrence_rule. The
// action layer reshapes flat FormData ("repeats"=on + "recurrence_freq" +
// "recurrence_days" + "recurrence_until") into this object before calling
// scheduledEventSchema.safeParse.
export const recurrenceRuleSchema = z.object({
  freq: z.enum(recurrenceFreqs),
  // 1=Mon, 7=Sun. Weekly-only; ignored otherwise.
  days: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1)
    .optional(),
  // Optional end date for the series. "YYYY-MM-DD".
  until: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional(),
  ),
});

export type RecurrenceRuleInput = z.infer<typeof recurrenceRuleSchema>;

export const scheduledEventSchema = z.object({
  domain: z.enum(scheduledEventDomains),
  event_type: z.enum(scheduledEventTypes),
  scheduled_for: z.coerce.date(),
  title: z.string().trim().min(1, "Title is required"),
  notes: optionalText,
  recurrence_rule: recurrenceRuleSchema.optional(),
});

export type ScheduledEventInput = z.infer<typeof scheduledEventSchema>;
