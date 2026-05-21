import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

// Phase 1 landing page — placeholder. The real homepage / dashboard arrives
// in Phase 6. For now this exists so visiting localhost:3000 shows something
// meaningful, links to the health-check endpoint, and exercises the auth
// flow (sign-in link if not signed in, signed-in email + logout if signed in).

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {user ? (
          <div className="flex flex-col items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Signed in as{" "}
              <span className="font-medium text-zinc-950 dark:text-zinc-50">
                {user.email}
              </span>
            </span>
            {/* Logout posts to a route handler so the cookie clear happens
                server-side. Form is the simplest no-JS way to POST. */}
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                className="text-xs uppercase tracking-wider text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium underline underline-offset-4 hover:text-zinc-950 dark:hover:text-zinc-50"
          >
            Sign in →
          </Link>
        )}
      </div>
    </main>
  );
}
