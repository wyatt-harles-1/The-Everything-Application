// Centralized chart theming. Every color here is a CSS-variable STRING, not a
// resolved value — Recharts passes stroke/fill straight to the SVG, and SVG
// paint attributes accept `var(--…)`. That means charts re-skin instantly when
// [data-theme] / [data-accent] flip on <html>, with zero JS and no re-render.
// (The one exception is the HTML tooltip, which uses token utility classes — see
// ChartTooltip.tsx.)

export const ACCENT = "var(--color-accent)";

// Shared prop shapes for the chart cards.
export type ChartSeries = { key: string; label: string; color?: string };
export type RefLine = { y: number; label?: string; color?: string };
export type RefBand = { y1: number; y2: number; color?: string };

// Categorical palette for multi-series charts (mood/energy/stress, etc.).
// Single-series charts should use ACCENT so they track the user's accent color.
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

export const AXIS_COLOR = "var(--color-muted)";
export const GRID_COLOR = "var(--color-border)";

// Shared Recharts <XAxis>/<YAxis> props.
export const axisProps = {
  stroke: GRID_COLOR,
  tick: { fill: AXIS_COLOR, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID_COLOR },
} as const;

// Shared <CartesianGrid> props — horizontal lines only, subtle.
export const gridProps = {
  stroke: GRID_COLOR,
  strokeDasharray: "3 3",
  vertical: false,
} as const;
