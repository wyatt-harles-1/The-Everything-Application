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

// Validation for acceptSuggestion(), the tool-shaped action invoked both by the
// suggestions panel and (per invariant #7) by the assistant's master agent. It
// differs from scheduledEventSchema in two ways: scheduled_for arrives as an
// already-formatted string (kept as-is for the insert, but validated as a real
// date), and event_type is bounded free text rather than the form's enum —
// the DB column is intentionally free text so the agent can schedule novel
// event types without a migration. Bounds prevent oversized / garbage rows
// from reaching the timeline (RLS already scopes ownership).
export const acceptSuggestionSchema = z.object({
  scheduled_for: z
    .string()
    .trim()
    .min(1, "scheduled_for is required")
    .refine((s) => !Number.isNaN(Date.parse(s)), "scheduled_for is not a valid date"),
  domain: z.enum(scheduledEventDomains),
  event_type: z.string().trim().min(1, "event_type is required").max(64),
  title: z.string().trim().min(1, "title is required").max(200),
  notes: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().max(2000).nullish(),
    ),
});

export type AcceptSuggestionInput = z.infer<typeof acceptSuggestionSchema>;
