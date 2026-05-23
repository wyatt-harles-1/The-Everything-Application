// Validation for shared.goals. The schema is liberal on purpose - goals
// can be quantitative ("bench 315 by July 1") or qualitative ("write
// every day"), so target_metric / target_value / target_date are all
// optional and the user types whatever makes sense.

import { z } from "zod";

import { scheduledEventDomains } from "./scheduler";

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().optional(),
);

const optionalNumber = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.number().optional(),
);

const optionalDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce.date().optional(),
);

export const goalStatuses = [
  "active",
  "paused",
  "achieved",
  "abandoned",
] as const;

export const goalSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: optionalText,
  domain: z.enum(scheduledEventDomains),
  category: optionalText,
  target_metric: optionalText,
  target_value: optionalNumber,
  target_date: optionalDate,
  priority: z.coerce.number().int().min(1).max(5),
});

export type GoalInput = z.infer<typeof goalSchema>;
