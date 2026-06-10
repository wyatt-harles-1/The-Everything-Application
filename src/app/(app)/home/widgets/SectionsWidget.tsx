// "Sections": grid of links into every module hub.

import { SectionHeader } from "@/components/ui/SectionHeader";

import { HomeTile } from "./HomeTile";

export function SectionsWidget() {
  return (
    <section>
      <SectionHeader title="Sections" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <HomeTile href="/schedule" label="Schedule" />
        <HomeTile href="/habits" label="Habits" />
        <HomeTile href="/goals" label="Goals" />
        <HomeTile href="/lifting" label="Lifting" />
        <HomeTile href="/running" label="Running" />
        <HomeTile href="/health" label="Health" />
        <HomeTile href="/assistant" label="Assistant" />
        <HomeTile href="/integrations" label="Integrations" />
      </div>
    </section>
  );
}
