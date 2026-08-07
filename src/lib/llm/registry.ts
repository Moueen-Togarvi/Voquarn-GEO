import type { ProviderCapability } from "@/generated/prisma/enums";
import { providerSupports } from "@/lib/llm/capabilities";
import { OpenAiProvider } from "@/lib/llm/openai";
import type { LlmProvider } from "@/lib/llm/types";

export type ProviderPurpose = "discovery" | "benchmark" | "generation";

type ProviderFactory = () => LlmProvider;

const PROVIDER_FACTORIES: Record<string, ProviderFactory> = {
  openai: () => new OpenAiProvider(),
};

const DEFAULT_PROVIDER_BY_PURPOSE: Record<ProviderPurpose, string> = {
  discovery: "openai",
  benchmark: "openai",
  generation: "openai",
};

const instances = new Map<string, LlmProvider>();

/**
 * Lazily constructs and caches one instance per provider name, the first
 * time it is actually needed — never at module import time. The old
 * A module-level provider singleton would read OPENAI_API_KEY the moment any
 * caller imported the adapter, regardless of whether that request path
 * needed a provider at all; that made tests order-sensitive and made
 * per-workspace BYOK and multi-model runs impossible. See
 * docs/adr/0003-provider-abstraction.md.
 */
export function getProvider(providerName: string): LlmProvider {
  const factory = PROVIDER_FACTORIES[providerName];
  if (!factory) {
    throw new Error(`Unknown LLM provider: "${providerName}".`);
  }

  let instance = instances.get(providerName);
  if (!instance) {
    instance = factory();
    instances.set(providerName, instance);
  }
  return instance;
}

export function resolveDefault(purpose: ProviderPurpose): LlmProvider {
  return getProvider(DEFAULT_PROVIDER_BY_PURPOSE[purpose]);
}

export function listProvidersWithCapability(
  capability: ProviderCapability,
): LlmProvider[] {
  return Object.keys(PROVIDER_FACTORIES)
    .filter((name) => providerSupports(name, capability))
    .map(getProvider);
}
