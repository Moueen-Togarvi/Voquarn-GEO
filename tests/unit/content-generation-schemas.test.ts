import { describe, expect, it } from "vitest";

import { briefSchema, buildBriefMessages } from "@/lib/content/brief";
import { buildSectionMessages, sectionDraftSchema } from "@/lib/content/draft";
import {
  buildClaimExtractionMessages,
  claimExtractionSchema,
} from "@/lib/content/claims";

describe("briefSchema", () => {
  it("accepts a well-formed brief", () => {
    const result = briefSchema.safeParse({
      audience: "SMB marketers",
      intent: "Informational",
      angle: "Practical how-to",
      outline: [
        { heading: "What is X", level: 2, notes: "", coverageGoal: "Define X" },
        { heading: "How to do X", level: 2, notes: "", coverageGoal: "Steps" },
      ],
      firstPartyInputsNeeded: [],
      internalLinkCandidates: [],
      visualSuggestions: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an outline with fewer than 2 sections", () => {
    const result = briefSchema.safeParse({
      audience: "a",
      intent: "b",
      angle: "c",
      outline: [
        { heading: "Only one", level: 2, notes: "", coverageGoal: "x" },
      ],
      firstPartyInputsNeeded: [],
      internalLinkCandidates: [],
      visualSuggestions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a heading level other than 2 or 3", () => {
    const result = briefSchema.safeParse({
      audience: "a",
      intent: "b",
      angle: "c",
      outline: [
        { heading: "One", level: 4, notes: "", coverageGoal: "x" },
        { heading: "Two", level: 2, notes: "", coverageGoal: "y" },
      ],
      firstPartyInputsNeeded: [],
      internalLinkCandidates: [],
      visualSuggestions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildBriefMessages", () => {
  it("includes brand, title, keyword, and evidence", () => {
    const messages = buildBriefMessages({
      contentTitle: "How to Fix a Widget",
      brandName: "Acme",
      brandCategory: "Widget software",
      brandTone: null,
      keywordText: "widget maintenance",
      targetWordCount: 1200,
      opportunitySummary: null,
      evidence: [
        { url: "https://example.com/a", title: "A", snippet: "Snippet A" },
      ],
      internalLinkCandidates: [],
    });
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("Acme");
    expect(user?.content).toContain("widget maintenance");
    expect(user?.content).toContain("https://example.com/a");
  });

  it("never fabricates internal link URLs beyond what it's told to instruct against", () => {
    const messages = buildBriefMessages({
      contentTitle: "Title",
      brandName: "Acme",
      brandCategory: "Software",
      brandTone: null,
      keywordText: null,
      targetWordCount: null,
      opportunitySummary: null,
      evidence: [],
      internalLinkCandidates: [],
    });
    const system = messages.find((m) => m.role === "system");
    expect(system?.content).toContain("never invent a URL");
  });
});

describe("sectionDraftSchema", () => {
  it("accepts a section with paragraphs", () => {
    expect(
      sectionDraftSchema.safeParse({
        paragraphs: ["A reasonably long paragraph."],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty paragraph list", () => {
    expect(sectionDraftSchema.safeParse({ paragraphs: [] }).success).toBe(
      false,
    );
  });

  it("rejects a paragraph that is too short", () => {
    expect(
      sectionDraftSchema.safeParse({ paragraphs: ["short"] }).success,
    ).toBe(false);
  });
});

describe("buildSectionMessages", () => {
  it("includes the section heading, coverage goal, and evidence", () => {
    const messages = buildSectionMessages({
      brandName: "Acme",
      brandTone: "Friendly",
      brandGuidelines: null,
      approvedSamples: [],
      contentTitle: "Full Article",
      sectionHeading: "Getting Started",
      sectionNotes: "",
      coverageGoal: "Explain setup",
      evidence: [],
      precedingHeadings: ["Introduction"],
    });
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("Getting Started");
    expect(user?.content).toContain("Explain setup");
    expect(user?.content).toContain("Introduction");
  });

  it("instructs placeholder markers instead of invented facts", () => {
    const messages = buildSectionMessages({
      brandName: "Acme",
      brandTone: null,
      brandGuidelines: null,
      approvedSamples: [],
      contentTitle: "Title",
      sectionHeading: "Section",
      sectionNotes: "",
      coverageGoal: "Goal",
      evidence: [],
      precedingHeadings: [],
    });
    const system = messages.find((m) => m.role === "system");
    expect(system?.content).toContain("[SOURCE NEEDED]");
    expect(system?.content).toContain("[EXPERT NEEDED]");
  });
});

describe("claimExtractionSchema", () => {
  it("accepts a valid claim list", () => {
    const result = claimExtractionSchema.safeParse({
      claims: [
        {
          text: "Our product handles 10,000 requests per second.",
          kind: "FACTUAL",
          riskCategory: null,
          evidenceUrl: "https://example.com/benchmark",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid claim kind", () => {
    const result = claimExtractionSchema.safeParse({
      claims: [
        {
          text: "Some claim.",
          kind: "GUESS",
          riskCategory: null,
          evidenceUrl: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildClaimExtractionMessages", () => {
  it("includes the evidence URLs and draft text", () => {
    const messages = buildClaimExtractionMessages({
      plainText: "This is the draft.",
      evidenceUrls: ["https://example.com/a"],
    });
    const user = messages.find((m) => m.role === "user");
    expect(user?.content).toContain("https://example.com/a");
    expect(user?.content).toContain("This is the draft.");
  });
});
