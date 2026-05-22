// Sign-in page. Two-stage OTP flow: email → 6-digit code.
//
// We dropped the original PKCE magic-link approach because PKCE stores a
// code_verifier cookie on the browser that submitted the form - which means
// you can't submit on laptop and click the link on your phone. The OTP code
// flow is stateless from the client's side: type the code, get a session.
//
// The legacy /auth/callback route is still in place so any old magic links
// in old emails won't 404, but the supported path is the code entry below.

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{
  error?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Already signed in? Skip the form and send them home.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Life Hub
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        </header>

        <LoginForm initialError={error} />
      </div>
    </main>
  );
}
