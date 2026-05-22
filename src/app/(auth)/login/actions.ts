// Server Actions for the OTP-code login flow.
//
// Two-step: request the code (email goes out via Resend), then verify the
// 6-digit code the user types in. PKCE / magic-link is the prior approach -
// we abandoned it because the code_verifier cookie only exists on the
// browser that submitted the request, breaking cross-device sign-in (submit
// on laptop, open mail on phone).
//
// The OTP code path is stateless from the client's perspective: verifyOtp
// sets session cookies directly on success, no callback hop needed.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();
const tokenSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export type LoginState =
  | { ok: false; banner?: string; errors?: { email?: string; token?: string } }
  | { ok: true; sent: true; email: string }
  | null;

// ----- Step 1: request the code ----------------------------------------------

export async function requestOtp(
  _prev: LoginState,
  fd: FormData,
): Promise<LoginState> {
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) {
    return { ok: false, errors: { email: "Enter a valid email address." } };
  }
  const email = parsed.data;

  const supabase = await createClient();

  // shouldCreateUser=false means an unknown email gets rejected up front
  // rather than silently creating an account. Sign-ups are still admin-only.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    return { ok: false, banner: error.message };
  }
  return { ok: true, sent: true, email };
}

// ----- Step 2: verify the 6-digit code ---------------------------------------

export async function verifyOtpCode(
  _prev: LoginState,
  fd: FormData,
): Promise<LoginState> {
  const emailParsed = emailSchema.safeParse(fd.get("email"));
  const tokenParsed = tokenSchema.safeParse(fd.get("token"));

  if (!emailParsed.success || !tokenParsed.success) {
    return {
      ok: false,
      errors: {
        email: emailParsed.success ? undefined : "Email missing or invalid.",
        token: tokenParsed.success ? undefined : "Enter the 6-digit code from your email.",
      },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email: emailParsed.data,
    token: tokenParsed.data,
    type: "email",
  });

  if (error) {
    return { ok: false, banner: error.message };
  }

  // Session cookies are now set by the server client's setAll callback.
  // Bust caches so the layout re-fetches the user, then send them home.
  revalidatePath("/", "layout");
  redirect("/");
}
