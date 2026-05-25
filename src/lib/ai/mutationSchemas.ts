// Zod schemas for every mutation the assistant can request. Shared by:
//  - The tool definitions (inputSchema)
//  - The /api/assistant/run-tool dispatcher (validates body.input)
//  - The mutation handlers (typed input arg)
// Keeping the schemas in one place means the model's input shape and
// the server's commit shape can never drift apart.

import { z } from "zod";

import { scheduledEventDomains } from "@/lib/validation/scheduler";

export const scheduleEventInput = z.object({
  domain: z.enum(scheduledEventDomains),
  event_type: z
    .string()
    .min(1)
    .describe("e.g. 'workout', 'meal', 'meditation', 'appointment'"),
  scheduled_for: z
    .string()
    .describe("ISO 8601 timestamp; the timezone should be the user's local"),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});
export type ScheduleEventInput = z.infer<typeof scheduleEventInput>;

export const markEventDoneInput = z.object({
  scheduled_event_id: z.string().uuid(),
});
export type MarkEventDoneInput = z.infer<typeof markEventDoneInput>;

export const markEventSkippedInput = z.object({
  scheduled_event_id: z.string().uuid(),
});
export type MarkEventSkippedInput = z.infer<typeof markEventSkippedInput>;

export const createHabitInput = z.object({
  name: z.string().min(1).max(120),
  domain: z.enum(scheduledEventDomains),
  event_type: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional further filter. Leave undefined for 'any event_type in the domain'.",
    ),
  target_frequency_per_week: z.number().int().min(1).max(14),
  started_at: z
    .string()
    .optional()
    .describe(
      "ISO date 'YYYY-MM-DD'. Earlier dates credit existing history. Defaults to today.",
    ),
  notes: z.string().max(2000).optional(),
});
export type CreateHabitInput = z.infer<typeof createHabitInput>;

export const createGoalInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  domain: z.enum(scheduledEventDomains),
  category: z.string().max(80).optional(),
  target_metric: z
    .string()
    .max(80)
    .optional()
    .describe("Slug e.g. 'bench_e1rm_lbs', 'total_saved_usd'"),
  target_value: z.number().optional(),
  target_date: z
    .string()
    .optional()
    .describe("ISO date 'YYYY-MM-DD'"),
  priority: z.number().int().min(1).max(5).default(3),
});
export type CreateGoalInput = z.infer<typeof createGoalInput>;

export const updateGoalStatusInput = z.object({
  goal_id: z.string().uuid(),
  status: z.enum(["active", "paused", "achieved", "abandoned"]),
});
export type UpdateGoalStatusInput = z.infer<typeof updateGoalStatusInput>;

// Invariant #8 rules-table mutations. Partial-update semantics: a field
// that is undefined in the payload means "leave the stored value alone";
// an explicit null clears the column. Schemas mirror the DB CHECK
// constraints so the model can't propose values the DB will reject.

const optionalTime = z
  .string()
  .regex(/^[0-9]{2}:[0-9]{2}$/, "Must be HH:MM 24h")
  .optional();
const optionalDays = z
  .array(z.number().int().min(1).max(7))
  .nullable()
  .optional();

export const updateLiftingRulesInput = z.object({
  frequency_per_week: z.number().int().min(0).max(7).optional(),
  preferred_days: optionalDays,
  default_time: optionalTime,
  skip_deload: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateLiftingRulesInput = z.infer<typeof updateLiftingRulesInput>;

export const updateRunningRulesInput = z.object({
  frequency_per_week: z.number().int().min(0).max(7).optional(),
  preferred_days: optionalDays,
  default_time: optionalTime,
  default_distance_meters: z.number().min(0).nullable().optional(),
  active_shoe_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateRunningRulesInput = z.infer<typeof updateRunningRulesInput>;

// Discriminated map - lets the dispatcher pick the right schema by name
// in a type-safe way.
export const mutationSchemas = {
  schedule_event: scheduleEventInput,
  mark_event_done: markEventDoneInput,
  mark_event_skipped: markEventSkippedInput,
  create_habit: createHabitInput,
  create_goal: createGoalInput,
  update_goal_status: updateGoalStatusInput,
  update_lifting_rules: updateLiftingRulesInput,
  update_running_rules: updateRunningRulesInput,
} as const;

export type MutationName = keyof typeof mutationSchemas;
