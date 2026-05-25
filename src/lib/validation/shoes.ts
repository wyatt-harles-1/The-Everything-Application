// Validation for wellness.shoes. The form collects retire_at_miles in
// user-friendly miles; the action converts to meters before insert so
// storage stays metric (parity with cardio_sessions.distance_meters).

import { z } from "zod";

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

export const shoeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  brand: optionalText,
  model: optionalText,
  // User types miles; action converts to meters.
  retire_at_miles: optionalNumber.refine(
    (v) => v === undefined || v >= 0,
    "Must be non-negative",
  ),
  started_at: z.coerce.date(),
  retired_at: optionalDate,
  notes: optionalText,
});

export type ShoeInput = z.infer<typeof shoeSchema>;
