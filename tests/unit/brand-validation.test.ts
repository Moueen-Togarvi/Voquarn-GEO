import { describe, expect, it } from "vitest";
import {
  brandDiscoveryInputSchema,
  brandInputSchema,
  domainFromUrl,
  normalizeUrl,
} from "@/lib/validation/brand";

const validInput = {
  name: "Voquarn",
  websiteUrl: "https://www.VOQUARN.com/",
  description: "AI visibility software for SaaS marketing teams.",
  category: "AI search visibility software for SaaS companies",
  competitors: [
    { name: "Peec", websiteUrl: "https://peec.ai/" },
    { name: "Profound", websiteUrl: "https://tryprofound.com" },
  ],
};

describe("brand validation", () => {
  it("accepts only the two user-supplied discovery fields", () => {
    const result = brandDiscoveryInputSchema.parse({
      name: "  Voquarn  ",
      websiteUrl: "https://WWW.VOQUARN.com/",
    });

    expect(result).toEqual({
      name: "Voquarn",
      websiteUrl: "https://www.voquarn.com",
    });
  });

  it("normalizes URLs and extracts a lowercase registrable host", () => {
    expect(normalizeUrl(" https://WWW.Example.COM/ ")).toBe(
      "https://www.example.com",
    );
    expect(domainFromUrl("https://www.example.com/path")).toBe("example.com");
  });

  it("accepts and normalizes a complete onboarding payload", () => {
    const result = brandInputSchema.parse(validInput);
    expect(result.websiteUrl).toBe("https://www.voquarn.com");
    expect(result.competitors[0]?.websiteUrl).toBe("https://peec.ai");
  });

  it("rejects fewer than two or more than four competitors", () => {
    expect(
      brandInputSchema.safeParse({
        ...validInput,
        competitors: validInput.competitors.slice(0, 1),
      }).success,
    ).toBe(false);

    expect(
      brandInputSchema.safeParse({
        ...validInput,
        competitors: Array.from({ length: 5 }, (_, index) => ({
          name: `Competitor ${index}`,
          websiteUrl: `https://competitor-${index}.com`,
        })),
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate competitors and the tracked brand itself", () => {
    const result = brandInputSchema.safeParse({
      ...validInput,
      competitors: [
        { name: "Voquarn", websiteUrl: "https://elsewhere.com" },
        { name: "Other", websiteUrl: "https://voquarn.com" },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("cannot match"),
        ),
      ).toBe(true);
    }
  });

  it("rejects non-http website protocols", () => {
    const result = brandInputSchema.safeParse({
      ...validInput,
      websiteUrl: "ftp://voquarn.com",
    });
    expect(result.success).toBe(false);
  });
});
