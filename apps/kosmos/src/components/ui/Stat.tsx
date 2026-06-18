// A single dashboard metric: small uppercase label, prominent tabular value,
// optional hint underneath. Used in stat grids on the home + module dashboards.

import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-text">{value}</p>
      {hint ? (
        <p className="text-[10px] uppercase tracking-wider text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
