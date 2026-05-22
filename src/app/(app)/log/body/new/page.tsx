import Link from "next/link";

import { BodyForm } from "../BodyForm";
import { createBody } from "../actions";

export default function NewBodyPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/log" className="text-xs text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
          ← Back to log
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Log body composition
        </h1>
      </header>

      <BodyForm action={createBody} submitLabel="Save measurement" />
    </div>
  );
}
