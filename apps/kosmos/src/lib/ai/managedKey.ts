// Authorization for the app-owned ("managed") AI provider keys.
//
// When a user sets use_managed_key=true, the assistant bills the OPERATOR's
// env-var API key (ANTHROPIC_API_KEY, etc.) instead of the user's own key.
// Without a gate, any signed-in user could opt into this and run unlimited LLM
// traffic on the operator's account. This module is the single source of truth
// for who is allowed to do that.
//
// Config: MANAGED_KEY_ALLOWLIST — a comma-separated list of email addresses.
// FAIL CLOSED: if the env var is unset or empty, NO account may use managed
// keys. The operator must explicitly add their own email to opt in. This is the
// safe default — a forgotten env var denies the cost-bearing feature rather
// than leaving it open to whoever signs up next.

import "server-only";

export function isManagedKeyAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.MANAGED_KEY_ALLOWLIST;
  if (!raw) return false;
  const allow = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
