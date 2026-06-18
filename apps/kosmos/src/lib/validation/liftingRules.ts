import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

// FormData encodes `preferred_days` as repeated values from a multi-checkbox.
// FormData.getAll() returns string[]; the action layer reshapes before this
// schema runs, so here we accept the already-parsed number[] form.
export const liftingRulesSchema = z.object({
  frequency_per_week: z.coerce
    .number()
    .int()
    .min(0, "Min 0/week (use 0 to disable suggestions)")
    .max(7, "Max 7/week"),
  preferred_days: z
    .array(z.coerce.number().int().min(1).max(7))
    .optional(),
  default_time: z
    .string()
    .regex(/^[0-9]{2}:[0-9]{2}$/, "Must be HH:MM (24h)"),
  skip_deload: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean(),
  ),
  notes: optionalText,
});

export type LiftingRulesInput = z.infer<typeof liftingRulesSchema>;
