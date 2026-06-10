// "Habits this week": top active habits with their weekly progress bars.

import { HabitCard, type HabitForCard } from "../../habits/HabitCard";
import type { HabitProgress } from "@/lib/scheduler/streak";
import { SectionHeader } from "@/components/ui/SectionHeader";

export type HabitItem = { habit: HabitForCard; progress: HabitProgress };

export function HabitsWidget({ items }: { items: HabitItem[] }) {
  return (
    <section>
      <SectionHeader title="Habits this week" action={{ href: "/habits", label: "all →" }} />
      <ul className="space-y-1.5">
        {items.map(({ habit, progress }) => (
          <li key={habit.id}>
            <HabitCard habit={habit} progress={progress} />
          </li>
        ))}
      </ul>
    </section>
  );
}
