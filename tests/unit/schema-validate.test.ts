import { describe, expect, it } from "vitest";

import { validateJsonLdBlock } from "@/lib/crawl/schema-validate";

describe("validateJsonLdBlock", () => {
  it("is valid when both @context and @type are present", () => {
    const result = validateJsonLdBlock({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "A post",
    });
    expect(result).toEqual({ type: "Article", valid: true, mismatches: [] });
  });

  it("flags a missing @context", () => {
    const result = validateJsonLdBlock({ "@type": "Article" });
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContain("Missing @context.");
  });

  it("flags a missing @type", () => {
    const result = validateJsonLdBlock({ "@context": "https://schema.org" });
    expect(result.valid).toBe(false);
    expect(result.mismatches).toContain("Missing @type.");
    expect(result.type).toBe("Unknown");
  });

  it("reads the first entry of an array-form @type", () => {
    const result = validateJsonLdBlock({
      "@context": "https://schema.org",
      "@type": ["Article", "NewsArticle"],
    });
    expect(result.type).toBe("Article");
    expect(result.valid).toBe(true);
  });
});
