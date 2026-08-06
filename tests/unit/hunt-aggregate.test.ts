import { describe, expect, it } from "vitest";

import {
  buildThreatComponentInputs,
  latestObservationPerKeyword,
} from "@/lib/hunt/aggregate";

describe("latestObservationPerKeyword", () => {
  it("keeps only the most recently fetched observation per keyword", () => {
    const result = latestObservationPerKeyword([
      {
        keywordId: "kw-1",
        position: 5,
        snapshotFetchedAt: "2026-08-01T00:00:00Z",
      },
      {
        keywordId: "kw-1",
        position: 2,
        snapshotFetchedAt: "2026-08-05T00:00:00Z",
      },
      {
        keywordId: "kw-2",
        position: 8,
        snapshotFetchedAt: "2026-08-03T00:00:00Z",
      },
    ]);
    expect(result).toHaveLength(2);
    const kw1 = result.find((observation) => observation.keywordId === "kw-1");
    expect(kw1?.position).toBe(2);
  });

  it("returns an empty array for no observations", () => {
    expect(latestObservationPerKeyword([])).toEqual([]);
  });
});

describe("buildThreatComponentInputs", () => {
  it("derives serpOverlap, prominence, and citationShare from raw evidence", () => {
    const { inputs, evidenceCount } = buildThreatComponentInputs({
      observations: [
        {
          keywordId: "kw-1",
          position: 1,
          snapshotFetchedAt: "2026-08-05T00:00:00Z",
        },
        {
          keywordId: "kw-2",
          position: 20,
          snapshotFetchedAt: "2026-08-05T00:00:00Z",
        },
      ],
      totalTrackedKeywords: 4,
      competitorMentions: 3,
      brandMentions: 1,
    });

    expect(evidenceCount).toBe(2);
    expect(inputs.serpOverlap).toBe(0.5); // 2 of 4 tracked keywords
    expect(inputs.prominence).toBe(0.5); // avg of position-1 (1) and position-20 (0)
    expect(inputs.citationShare).toBe(0.75); // 3 / (3 + 1)
    expect(inputs.authorityProxy).toBeNull();
    expect(inputs.freshness).toBeNull();
    expect(inputs.backlinks).toBeNull();
  });

  it("returns null components (not zero) when there is no evidence at all", () => {
    const { inputs, evidenceCount } = buildThreatComponentInputs({
      observations: [],
      totalTrackedKeywords: 0,
      competitorMentions: 0,
      brandMentions: 0,
    });
    expect(evidenceCount).toBe(0);
    expect(inputs.serpOverlap).toBeNull();
    expect(inputs.prominence).toBeNull();
    expect(inputs.citationShare).toBeNull();
  });

  it("collapses repeated observations of the same keyword before computing prominence", () => {
    const { inputs } = buildThreatComponentInputs({
      observations: [
        {
          keywordId: "kw-1",
          position: 1,
          snapshotFetchedAt: "2026-08-01T00:00:00Z",
        },
        {
          keywordId: "kw-1",
          position: 10,
          snapshotFetchedAt: "2026-08-05T00:00:00Z",
        },
      ],
      totalTrackedKeywords: 1,
      competitorMentions: 0,
      brandMentions: 0,
    });
    // Only the later (2026-08-05, position 10) observation should count.
    expect(inputs.prominence).toBeCloseTo(1 - 9 / 19);
  });
});
