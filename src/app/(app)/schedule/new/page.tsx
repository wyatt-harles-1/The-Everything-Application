import Link from "next/link";

import { ScheduledEventForm } from "../ScheduledEventForm";
import { createScheduledEvent } from "../actions";

export default function NewScheduledEventPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/schedule"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Schedule
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Add to schedule
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          One-off planned events. Recurring tasks + calendar view land in
          the next sub-wave.
        </p>
      </header>

      <ScheduledEventForm
        action={createScheduledEvent}
        submitLabel="Schedule it"
      />
    </div>
  );
}
