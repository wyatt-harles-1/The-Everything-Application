import Link from "next/link";

import { SleepForm } from "../SleepForm";
import { createSleep } from "../actions";

export default function NewSleepPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/log"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Log sleep
        </h1>
      </header>

      <SleepForm action={createSleep} submitLabel="Save sleep" />
    </div>
  );
}
