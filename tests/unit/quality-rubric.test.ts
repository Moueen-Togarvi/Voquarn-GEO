import { describe, expect, it } from "vitest";

import {
  QUALITY_JUDGE_VERSION,
  buildQualityJudgeMessages,
  qualityJudgeSchema,
} from "@/lib/quality/rubric";

describe("qualityJudgeSchema", () => {
  it("accepts a fully-scored response", () => {
    const result = qualityJudgeSchema.safeParse({
      intentSatisfaction: 0.8,
      originalContribution: 0.5,
      evidenceCoverage: 0.9,
      completeness: 0.7,
      brandFit: 0.6,
      readability: 0.85,
      internalLinkRelevance: 0.4,
      policyCompliance: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a score outside 0-1", () => {
    const result = qualityJudgeSchema.safeParse({
      intentSatisfaction: 1.5,
      originalContribution: 0.5,
      evidenceCoverage: 0.9,
      completeness: 0.7,
      brandFit: 0.6,
      readability: 0.85,
      internalLinkRelevance: 0.4,
      policyCompliance: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a response missing a required dimension", () => {
    const result = qualityJudgeSchema.safeParse({
      intentSatisfaction: 0.8,
      originalContribution: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("buildQualityJudgeMessages", () => {
  it("includes the brand, title, outline, and draft text", () => {
    const messages = buildQualityJudgeMessages({
      title: "How to Fix a Widget",
      plainText: "Widgets break when overloaded.",
      brandName: "Acme",
      brandTone: "Friendly and direct",
      outline: [{ heading: "Intro" }],
    });

    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("Acme");
    expect(userMessage?.content).toContain("How to Fix a Widget");
    expect(userMessage?.content).toContain("Friendly and direct");
    expect(userMessage?.content).toContain("Widgets break when overloaded.");
  });

  it("omits the tone line entirely when no brand tone is set", () => {
    const messages = buildQualityJudgeMessages({
      title: "Title",
      plainText: "Text.",
      brandName: "Acme",
      brandTone: null,
      outline: [],
    });
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).not.toContain("Brand tone:");
  });

  it("is versioned so a rubric change is auditable", () => {
    expect(QUALITY_JUDGE_VERSION).toBe("quality-judge-v1");
  });
});
