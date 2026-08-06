import { describe, expect, it } from "vitest";

import { generateLlmsTxt } from "@/lib/geo/llms-txt";

describe("generateLlmsTxt", () => {
  it("renders the H1 name and blockquote summary", () => {
    const result = generateLlmsTxt({
      brandName: "Voquarn",
      description: "AI visibility tracking for SaaS teams.",
    });
    expect(result).toContain("# Voquarn");
    expect(result).toContain("> AI visibility tracking for SaaS teams.");
  });

  it("omits the Pages section when no key pages are given", () => {
    const result = generateLlmsTxt({
      brandName: "Voquarn",
      description: "desc",
    });
    expect(result).not.toContain("## Pages");
  });

  it("lists key pages as markdown links under a Pages heading", () => {
    const result = generateLlmsTxt({
      brandName: "Voquarn",
      description: "desc",
      keyPages: [
        { title: "Pricing", url: "https://voquarn.com/pricing" },
        { title: "About", url: "https://voquarn.com/about" },
      ],
    });
    expect(result).toContain("## Pages");
    expect(result).toContain("- [Pricing](https://voquarn.com/pricing)");
    expect(result).toContain("- [About](https://voquarn.com/about)");
  });

  it("ends with exactly one trailing newline", () => {
    const result = generateLlmsTxt({
      brandName: "Voquarn",
      description: "desc",
    });
    expect(result.endsWith("\n")).toBe(true);
    expect(result.endsWith("\n\n")).toBe(false);
  });
});
