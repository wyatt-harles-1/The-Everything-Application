// Shared types + constants for user UI preferences (theme / accent / density).
// Pure module — no server-only imports — so it's safe in client components,
// server components, and the cookie helpers alike.

import { z } from "zod";

export const THEMES = ["system", "light", "dark", "amoled"] as const;
export const ACCENTS = [
  "indigo",
  "emerald",
  "rose",
  "amber",
  "violet",
  "sky",
] as const;
export const DENSITIES = ["comfortable", "compact"] as const;

export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];
export type Density = (typeof DENSITIES)[number];

export type Preferences = {
  theme: Theme;
  accent: Accent;
  density: Density;
};

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  accent: "indigo",
  density: "comfortable",
};

// Lenient per-field schemas: anything unrecognized falls back to the default
// rather than throwing, so a stale/garbage cookie never breaks a page render.
export const preferencesSchema = z.object({
  theme: z.enum(THEMES).catch(DEFAULT_PREFERENCES.theme),
  accent: z.enum(ACCENTS).catch(DEFAULT_PREFERENCES.accent),
  density: z.enum(DENSITIES).catch(DEFAULT_PREFERENCES.density),
});

// Patch used by the appearance controls — any subset of the three fields.
export const preferencesPatchSchema = z
  .object({
    theme: z.enum(THEMES),
    accent: z.enum(ACCENTS),
    density: z.enum(DENSITIES),
  })
  .partial();

export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;
