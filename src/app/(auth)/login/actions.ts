// Server Action for the magic-link login form. Lives in a separate file so
// the form `action={...}` prop can reference it directly — Next.js requires
// Server Actions to be either inline in a Server Component or imported from
// a "use server" module.

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

export async function requestMagicLink(formData: FormData) {
  // Validate before hitting Supabase so a malformed email doesn't burn a slot
  // against the per-hour magic-link rate limit (config.toml: email_sent = 2).
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent("Enter a valid email address.")}`);
  }
  const email = parsed.data;

  const supabase = await createClient();

  // The `origin` header tells us where the request came from (e.g.
  // http://localhost:3000). Computing the callback URL from it means the same
  // code works locally and after we deploy to Vercel without an env var.
  const origin = (await headers()).get("origin");
  if (!origin) {
    redirect(`/login?error=${encodeURIComponent("Could not determine request origin.")}`);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // shouldCreateUser=false: only allow existing users to sign in. New
      // users are created in Supabase Studio for now (per README). Flip to
      // true when we want self-service signup.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?sent=1");
}
