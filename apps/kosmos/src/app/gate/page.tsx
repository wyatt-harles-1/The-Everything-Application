// Site-wide passcode gate.
//
// When SITE_PASSCODE is set, the middleware redirects every un-cookied
// request to /gate?from=<original>. The user submits the passcode here;
// on success we set an HttpOnly cookie carrying a SHA-256 hash of the
// passcode and bounce them back to `from`.
//
// This route is the only one the middleware does NOT gate (otherwise
// users couldn't reach the form to unlock). Static assets (_next/static
// etc.) are already excluded via the middleware's matcher.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE_SECONDS,
  sha256Hex,
} from "@/lib/gate";

type SearchParams = Promise<{
  from?: string;
  error?: string;
}>;

async function submit(formData: FormData) {
  "use server";

  const passcode = process.env.SITE_PASSCODE ?? "";
  const entered = String(formData.get("passcode") ?? "");
  const fromRaw = String(formData.get("from") ?? "/");
  // Only allow same-origin paths to prevent open-redirect via ?from=...
  const from = fromRaw.startsWith("/") && !fromRaw.startsWith("//") ? fromRaw : "/";

  if (!passcode || entered !== passcode) {
    redirect(`/gate?error=1&from=${encodeURIComponent(from)}`);
  }

  const hash = await sha256Hex(passcode);
  const jar = await cookies();
  jar.set(GATE_COOKIE, hash, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE_SECONDS,
  });
  redirect(from);
}

export default async function GatePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { from = "/", error } = await searchParams;
  const safeFrom = from.startsWith("/") && !from.startsWith("//") ? from : "/";

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Kosmos
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Enter passcode
          </h1>
        </header>

        <form action={submit} className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="passcode"
              className="flex items-center justify-between text-sm font-medium"
            >
              <span>Passcode</span>
            </label>
            <input
              type="password"
              id="passcode"
              name="passcode"
              required
              autoFocus
              autoComplete="current-password"
              className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-50 dark:focus:ring-zinc-50"
            />
          </div>

          <input type="hidden" name="from" value={safeFrom} />

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              Incorrect passcode.
            </p>
          ) : null}

          <button
            type="submit"
            className="min-h-11 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Enter
          </button>
        </form>
      </div>
    </main>
  );
}
