// Shared base classes for form controls, so the inputs/select/date pickers all
// stay visually identical and a restyle happens in one place. Token-based
// (border-border, bg-surface, text-text, ring-accent) so they follow the active
// theme + density with no dark: pairs.

// Textarea uses this (height comes from `rows`).
export const FIELD_CLASS =
  "w-full rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft transition-colors placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

// Single-line controls get the density-aware tap-target height too.
export const FIELD_CONTROL_CLASS = `min-h-[var(--control-h)] ${FIELD_CLASS}`;
