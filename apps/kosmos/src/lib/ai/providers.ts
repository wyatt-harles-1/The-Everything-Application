// Pure constants safe to import from client components. Logic that
// needs server-only secrets lives in ./provider.ts (singular - that
// one's server-only).

export const SUPPORTED_PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "mistral",
  "groq",
] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];
