// Layout for every auth-protected page. Two responsibilities:
//
//   1. Auth guard: if the user isn't signed in, bounce them to /login. This
//      runs as a Server Component so the redirect happens before any
//      protected content is sent over the wire.
//   2. Wrap the children with the top nav and a constrained content column.
//
// Pages under this layout are at the same URL as if they were at the
// top level (Next.js route groups are path-invisible) - this layout just
// pushes a guard + chrome around them.

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { Nav } from "@/components/Nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <>
      <Nav email={user.email ?? "signed in"} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
