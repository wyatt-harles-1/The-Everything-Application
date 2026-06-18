// "Top goals": the highest-priority active goals.

import { GoalCard, type GoalForCard } from "../../goals/GoalCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function GoalsWidget({ goals }: { goals: GoalForCard[] }) {
  return (
    <section>
      <SectionHeader title="Top goals" action={{ href: "/goals", label: "all →" }} />
      <ul className="space-y-1.5">
        {goals.map((g) => (
          <li key={g.id}>
            <GoalCard goal={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}
