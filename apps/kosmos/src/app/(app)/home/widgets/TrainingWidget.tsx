// "Training block": the active mesocycle + its week/deload status.

import Link from "next/link";

import {
  formatMesoStatusShort,
  type MesoProgress,
  type MesocycleRow,
} from "@/lib/lifting/mesocycle";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function TrainingWidget({
  meso,
  progress,
}: {
  meso: MesocycleRow;
  progress: MesoProgress;
}) {
  return (
    <section>
      <SectionHeader title="Training block" />
      <Link
        href={`/lifting/mesocycles/${meso.id}`}
        className="block rounded-[var(--radius-card)] border border-border bg-surface p-3 transition-colors hover:bg-hover"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-text">{meso.name}</span>
          <span
            className={`shrink-0 text-xs ${
              progress.isDeloadWeek ? "text-warn" : "text-muted"
            }`}
          >
            {formatMesoStatusShort(progress, meso.planned_weeks)}
          </span>
        </div>
      </Link>
    </section>
  );
}
