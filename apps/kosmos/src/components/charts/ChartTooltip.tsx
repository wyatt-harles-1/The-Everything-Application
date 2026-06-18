// Token-styled replacement for Recharts' default tooltip (which is an inline-
// styled white box that ignores our theme). Passed via <Tooltip content={...}>;
// Recharts injects active/payload/label when it clones the element.

"use client";

type TooltipPayloadItem = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
};

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (v: number | string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface-raised px-3 py-2 text-xs shadow-pop">
      {label != null && label !== "" ? (
        <p className="mb-1 font-medium text-text">{label}</p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-text">
              {valueFormatter && p.value != null && p.value !== ""
                ? valueFormatter(p.value)
                : p.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
