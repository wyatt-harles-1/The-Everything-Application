// Two-stage login: email → 6-digit code. Each stage has its own
// useActionState because the actions return different state shapes and
// keeping them separate avoids confusion about which fields are live in
// which stage.

"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/FormField";
import { TextInput } from "@/components/forms/TextInput";
import { SubmitButton } from "@/components/forms/SubmitButton";

import { requestOtp, verifyOtpCode, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  // Local state controls which stage is showing. The email stage's action
  // hands us the verified email; we hold onto it and show the code stage.
  const [emailForCode, setEmailForCode] = useState<string | null>(null);

  if (emailForCode) {
    return (
      <CodeStage
        email={emailForCode}
        onBack={() => setEmailForCode(null)}
      />
    );
  }
  return (
    <EmailStage
      initialError={initialError}
      onSent={(email) => setEmailForCode(email)}
    />
  );
}

function EmailStage({
  initialError,
  onSent,
}: {
  initialError?: string;
  onSent: (email: string) => void;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    async (prev, fd) => {
      const next = await requestOtp(prev, fd);
      if (next && "sent" in next && next.sent) onSent(next.email);
      return next;
    },
    null,
  );

  const banner =
    initialError ??
    (state && "banner" in state && state.ok === false ? state.banner : undefined);
  const emailErr =
    state && "errors" in state && state.ok === false
      ? state.errors?.email
      : undefined;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {banner ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
        >
          {banner}
        </p>
      ) : null}

      <FormField label="Email" htmlFor="email" required error={emailErr}>
        <TextInput
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
        />
      </FormField>

      <SubmitButton pendingLabel="Sending…">Send code</SubmitButton>
    </form>
  );
}

function CodeStage({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(
    verifyOtpCode,
    null,
  );

  const banner =
    state && "banner" in state && state.ok === false ? state.banner : undefined;
  const tokenErr =
    state && "errors" in state && state.ok === false
      ? state.errors?.token
      : undefined;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        Code sent to <span className="font-medium">{email}</span>. Check your
        inbox.
      </p>

      {banner ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
        >
          {banner}
        </p>
      ) : null}

      {/* The email is needed by the verify action - pass it through hidden. */}
      <input type="hidden" name="email" value={email} />

      <FormField label="Code from email" htmlFor="token" required error={tokenErr}>
        <TextInput
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          pattern="\d{4,10}"
          maxLength={10}
          placeholder="••••••••"
          className="tracking-[0.3em] text-center text-lg"
        />
      </FormField>

      <SubmitButton pendingLabel="Verifying…">Sign in</SubmitButton>

      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center text-xs text-zinc-500 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        Use a different email
      </button>
    </form>
  );
}
