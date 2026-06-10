// Resolves the AI model the user has configured, using the Vercel AI
// SDK's unified language-model interface. Caller does:
//
//   const model = await getModelForUser(supabase, userId);
//   streamText({ model, messages, tools });
//
// Provider switching, BYOK decryption, and managed-key fallback all live
// here so callers stay provider-agnostic.

import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptApiKey } from "./encryption";
import { isManagedKeyAllowed } from "./managedKey";
import { SUPPORTED_PROVIDERS, type Provider } from "./providers";

export { SUPPORTED_PROVIDERS, type Provider };

// Per-provider defaults. Picked for cost-effective everyday use; the
// user can override per-row in settings.
const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-5",
  google: "gemini-2.5-flash",
  mistral: "mistral-large-latest",
  groq: "llama-3.3-70b-versatile",
};

// Per-provider env-var name for the managed (app-owned) key. If the
// user picked use_managed_key=true and this env var is set, we use it.
const MANAGED_KEY_ENV: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
};

type UserAISettingsRow = {
  provider: Provider;
  model_id: string | null;
  api_key_encrypted: string | null;
  use_managed_key: boolean;
};

export class AINotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AINotConfiguredError";
  }
}

export async function getModelForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ model: LanguageModel; provider: Provider; modelId: string }> {
  const { data: row } = await supabase
    .schema("shared")
    .from("user_ai_settings")
    .select("provider, model_id, api_key_encrypted, use_managed_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) {
    throw new AINotConfiguredError(
      "You haven't configured an AI provider yet. Open /assistant/settings to add a key.",
    );
  }
  const settings = row as UserAISettingsRow;
  const provider = settings.provider;
  const modelId = settings.model_id || DEFAULT_MODEL[provider];

  // Resolve the API key: managed env var if opted in, else decrypt the
  // user's stored key.
  let apiKey: string;
  if (settings.use_managed_key) {
    // The managed key bills the operator, so re-check authorization at the
    // point of use (not just at save time) — this defends even if a row was
    // written with use_managed_key=true before the allowlist existed, or via a
    // direct DB edit. The per-request `supabase` client is the signed-in user's
    // session, so getUser() returns the account that would be billed.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isManagedKeyAllowed(user?.email)) {
      throw new AINotConfiguredError(
        "This account isn't permitted to use the app's managed API key. Add your own provider API key in /assistant/settings.",
      );
    }
    const envKey = process.env[MANAGED_KEY_ENV[provider]];
    if (!envKey) {
      throw new AINotConfiguredError(
        `Managed mode selected for ${provider} but ${MANAGED_KEY_ENV[provider]} isn't set in the app's environment.`,
      );
    }
    apiKey = envKey;
  } else {
    if (!settings.api_key_encrypted) {
      throw new AINotConfiguredError(
        `No API key on file for ${provider}. Add one in /assistant/settings.`,
      );
    }
    apiKey = decryptApiKey(settings.api_key_encrypted);
  }

  const model = instantiateModel(provider, modelId, apiKey);
  return { model, provider, modelId };
}

function instantiateModel(
  provider: Provider,
  modelId: string,
  apiKey: string,
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "mistral":
    case "groq":
      // These providers ship through @ai-sdk/openai-compatible or a
      // dedicated package; deferred until the user picks one. For now
      // they're listed in the schema CHECK but reaching them throws.
      throw new AINotConfiguredError(
        `${provider} is in the schema but the runtime adapter isn't wired up yet. Pick anthropic, openai, or google for now.`,
      );
  }
}
