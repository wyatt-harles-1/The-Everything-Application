// "Quick log": the four most-logged entry types, one tap to their new-form.

import { SectionHeader } from "@/components/ui/SectionHeader";

import { HomeTile } from "./HomeTile";

export function QuickLogWidget() {
  return (
    <section>
      <SectionHeader title="Quick log" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <HomeTile href="/log/workout/new" label="Workout" />
        <HomeTile href="/log/meal/new" label="Meal" />
        <HomeTile href="/log/sleep/new" label="Sleep" />
        <HomeTile href="/log/mood/new" label="Mood" />
      </div>
    </section>
  );
}
