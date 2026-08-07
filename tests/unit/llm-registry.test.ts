import { describe, expect, it } from "vitest";

import { providerSupports, registeredProviders } from "@/lib/llm/capabilities";
import {
  getProvider,
  listProvidersWithCapability,
  resolveDefault,
} from "@/lib/llm/registry";

describe("provider registry", () => {
  it("throws on an unknown provider name rather than returning undefined", () => {
    expect(() => getProvider("does-not-exist")).toThrow(/Unknown LLM provider/);
  });

  it("lazily constructs and caches one instance per provider name", () => {
    const first = getProvider("openai");
    const second = getProvider("openai");
    expect(first).toBe(second);
    expect(first.provider).toBe("openai");
  });

  it("resolves a sensible default provider for each purpose", () => {
    expect(resolveDefault("discovery").provider).toBe("openai");
    expect(resolveDefault("benchmark").provider).toBe("openai");
    expect(resolveDefault("generation").provider).toBe("openai");
  });

  it("filters providers by capability using the capabilities table", () => {
    expect(providerSupports("openai", "GENERATION")).toBe(true);
    expect(providerSupports("openai", "CRAWL")).toBe(false);
    expect(providerSupports("unknown-provider", "GENERATION")).toBe(false);

    const benchmarkProviders = listProvidersWithCapability("BENCHMARK");
    expect(benchmarkProviders.map((p) => p.provider)).toContain("openai");

    const crawlProviders = listProvidersWithCapability("CRAWL");
    expect(crawlProviders).toHaveLength(0);
  });

  it("registeredProviders reflects every provider the registry knows about", () => {
    expect(registeredProviders()).toContain("openai");
  });
});
