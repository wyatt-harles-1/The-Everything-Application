import Link from "next/link";

// Phase 1 landing page — placeholder. The real homepage / dashboard arrives
// in Phase 6. For now this exists so visiting localhost:3000 shows something
// meaningful and links to the health-check endpoint.

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        Phase 1
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Life Hub
      </h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Foundation: schemas, sources, events, goals. No UI yet — manual logging
        arrives in Phase 2.
      </p>
      <Link
        href="/api/health"
        className="mt-4 text-sm font-medium underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
      >
        Check database health →
      </Link>
    </main>
  );
}
