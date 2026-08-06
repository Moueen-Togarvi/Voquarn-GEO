import { describe, expect, it } from "vitest";

import {
  computeBlockers,
  detectClaimBlockers,
  detectPlaceholders,
  type ClaimWithEvidence,
} from "@/lib/content/blockers";

function claim(overrides: Partial<ClaimWithEvidence> = {}): ClaimWithEvidence {
  return {
    id: "claim_1",
    text: "Our product processes 10,000 requests per second.",
    kind: "FACTUAL",
    status: "UNRESOLVED",
    riskCategory: null,
    hasEvidence: false,
    ...overrides,
  };
}

describe("detectPlaceholders", () => {
  it("flags [SOURCE NEEDED] and [EXPERT NEEDED]", () => {
    const blockers = detectPlaceholders(
      "Our tool is fast [SOURCE NEEDED]. A doctor recommends it [EXPERT NEEDED].",
    );
    expect(blockers.map((b) => b.message)).toEqual([
      "Unresolved placeholder: [SOURCE NEEDED]",
      "Unresolved placeholder: [EXPERT NEEDED]",
    ]);
  });

  it("flags other bracketed all-caps placeholders too", () => {
    const blockers = detectPlaceholders("Pricing starts at [ADD PRICING].");
    expect(blockers).toHaveLength(1);
    expect(blockers[0]?.kind).toBe("PLACEHOLDER");
  });

  it("does not flag a short bracketed citation marker", () => {
    expect(detectPlaceholders("This is well known [1].")).toEqual([]);
  });

  it("deduplicates repeated placeholders", () => {
    const blockers = detectPlaceholders(
      "[SOURCE NEEDED] appears twice [SOURCE NEEDED].",
    );
    expect(blockers).toHaveLength(1);
  });

  it("returns nothing for clean text", () => {
    expect(
      detectPlaceholders("This sentence has no placeholders at all."),
    ).toEqual([]);
  });
});

describe("detectClaimBlockers", () => {
  it("blocks an unsourced factual claim", () => {
    const blockers = detectClaimBlockers([claim()]);
    expect(blockers.map((b) => b.kind)).toContain("UNSOURCED_CLAIM");
  });

  it("does not block a factual claim that has evidence", () => {
    const blockers = detectClaimBlockers([claim({ hasEvidence: true })]);
    expect(blockers).toEqual([]);
  });

  it("does not block an opinion claim even without evidence", () => {
    const blockers = detectClaimBlockers([
      claim({ kind: "OPINION", text: "We think this is the best approach." }),
    ]);
    expect(blockers).toEqual([]);
  });

  it("does not block a first-party claim even without evidence", () => {
    const blockers = detectClaimBlockers([
      claim({
        kind: "FIRST_PARTY",
        text: "In our testing, this took 2 minutes.",
      }),
    ]);
    expect(blockers).toEqual([]);
  });

  it("blocks a risky claim regardless of sourcing", () => {
    const blockers = detectClaimBlockers([
      claim({
        kind: "OPINION",
        riskCategory: "MEDICAL",
        hasEvidence: true,
        text: "This supplement cures headaches.",
      }),
    ]);
    expect(blockers.map((b) => b.kind)).toContain("RISKY_CLAIM");
  });

  it("blocks an unsourced quoted claim as an invented quote", () => {
    const blockers = detectClaimBlockers([
      claim({
        kind: "OPINION",
        text: 'Our CEO said "this changes everything for our customers."',
      }),
    ]);
    expect(blockers.map((b) => b.kind)).toContain("INVENTED_QUOTE");
  });

  it("does not flag a sourced quote as invented", () => {
    const blockers = detectClaimBlockers([
      claim({
        kind: "OPINION",
        hasEvidence: true,
        text: 'Our CEO said "this changes everything for our customers."',
      }),
    ]);
    expect(blockers.map((b) => b.kind)).not.toContain("INVENTED_QUOTE");
  });

  it("attaches the claim id to each blocker", () => {
    const blockers = detectClaimBlockers([claim({ id: "claim_abc" })]);
    expect(blockers[0]?.claimId).toBe("claim_abc");
  });
});

describe("computeBlockers", () => {
  it("combines placeholder and claim blockers", () => {
    const blockers = computeBlockers({
      text: "Fast [SOURCE NEEDED].",
      claims: [claim()],
    });
    expect(blockers.map((b) => b.kind)).toEqual([
      "PLACEHOLDER",
      "UNSOURCED_CLAIM",
    ]);
  });

  it("returns an empty list when there is nothing to block on", () => {
    expect(
      computeBlockers({
        text: "Clean text.",
        claims: [claim({ hasEvidence: true })],
      }),
    ).toEqual([]);
  });
});
