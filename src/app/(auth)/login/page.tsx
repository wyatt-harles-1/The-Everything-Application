// Magic-link login page. The Server Action in ./actions.ts sends the email;
// Supabase delivers the link; the user clicks it; /auth/callback exchanges
// the code for a session. In local dev, Supabase's Mailpit at
// http://localhost:54324 catches outbound mail so no real inbox is needed.
//
// Status messages (?sent=1, ?error=...) are rendered server-side from
// searchParams so this whole page can stay a Server Component — no client
// JS shipped to render the form.

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { requestMagicLink } from "./actions";

type SearchParams = Promise<{
  sent?: string;
  error?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Already signed in? Skip the form and send them to the landing page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { sent, error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Life Hub
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        </header>

        <form action={requestMagicLink} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Send magic link
          </button>
        </form>

        {sent === "1" ? (
          <p
            role="status"
            className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          >
            Check your inbox. In local dev, the link is at{" "}
            <a
              href="http://localhost:54324"
              className="underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Mailpit
            </a>
            .
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
          >
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
