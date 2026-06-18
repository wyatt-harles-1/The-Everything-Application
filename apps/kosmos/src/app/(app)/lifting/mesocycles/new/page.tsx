import Link from "next/link";

import { MesocycleForm } from "../MesocycleForm";
import { createMesocycle } from "../actions";

export default function NewMesocyclePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/lifting/mesocycles"
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Mesocycles
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          New mesocycle
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          One block runs at a time. New lifting sessions auto-tag to the
          active block.
        </p>
      </header>

      <MesocycleForm action={createMesocycle} submitLabel="Start mesocycle" />
    </div>
  );
}
