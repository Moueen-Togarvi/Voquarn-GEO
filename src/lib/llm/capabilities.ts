import type { ProviderCapability } from "@/generated/prisma/enums";

/**
 * Which ProviderCapability values each registered provider name supports.
 * The registry uses this to filter eligible providers for a purpose (e.g.
 * "give me every provider that can run a benchmark") rather than every
 * caller hardcoding provider names.
 */
const PROVIDER_CAPABILITIES: Record<string, ProviderCapability[]> = {
  zai: ["GENERATION", "BENCHMARK"],
};

export function providerSupports(
  provider: string,
  capability: ProviderCapability,
): boolean {
  return PROVIDER_CAPABILITIES[provider]?.includes(capability) ?? false;
}

export function registeredProviders(): string[] {
  return Object.keys(PROVIDER_CAPABILITIES);
}
