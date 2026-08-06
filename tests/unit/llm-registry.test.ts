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
    const first = getProvider("zai");
    const second = getProvider("zai");
    expect(first).toBe(second);
    expect(first.provider).toBe("zai");
  });

  it("resolves a sensible default provider for each purpose", () => {
    expect(resolveDefault("discovery").provider).toBe("zai");
    expect(resolveDefault("benchmark").provider).toBe("zai");
    expect(resolveDefault("generation").provider).toBe("zai");
  });

  it("filters providers by capability using the capabilities table", () => {
    expect(providerSupports("zai", "GENERATION")).toBe(true);
    expect(providerSupports("zai", "CRAWL")).toBe(false);
    expect(providerSupports("unknown-provider", "GENERATION")).toBe(false);

    const benchmarkProviders = listProvidersWithCapability("BENCHMARK");
    expect(benchmarkProviders.map((p) => p.provider)).toContain("zai");

    const crawlProviders = listProvidersWithCapability("CRAWL");
    expect(crawlProviders).toHaveLength(0);
  });

  it("registeredProviders reflects every provider the registry knows about", () => {
    expect(registeredProviders()).toContain("zai");
  });
});
