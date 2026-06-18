// Shared chrome for every chart card: a token Card with an optional title/hint
// header and a fixed-height chart area. Charts need an explicit height because
// Recharts' ResponsiveContainer measures its parent (and renders empty for one
// frame on mount if the parent has no height).

import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";

export function ChartCardShell({
  title,
  hint,
  height = 220,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      {title ? (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        </div>
      ) : null}
      <div style={{ width: "100%", height }}>{children}</div>
    </Card>
  );
}
