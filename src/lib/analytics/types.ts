// Shared shapes for chart data. A TrendResult is what every metric builder
// returns and what the chart cards consume: `points` are plain serializable
// rows (x = label string, plus one key per series), `series` describes the
// lines/bars to draw, and `summary` carries derived numbers for annotations
// (7-day average, 30-day delta, latest value).

export type ChartPoint = { [key: string]: number | string | null };

export type Series = { key: string; label: string; color?: string };

export type TrendResult = {
  points: ChartPoint[];
  series: Series[];
  summary?: Record<string, number | null>;
};
