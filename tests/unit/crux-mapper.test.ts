import { describe, expect, it } from "vitest";

import { mapCruxMetrics } from "@/lib/providers/crux/client";

describe("mapCruxMetrics", () => {
  it("maps p75 LCP, INP, and CLS from the record", () => {
    const result = mapCruxMetrics({
      record: {
        metrics: {
          largest_contentful_paint: { percentiles: { p75: 2400 } },
          interaction_to_next_paint: { percentiles: { p75: 180 } },
          cumulative_layout_shift: { percentiles: { p75: 0.05 } },
        },
      },
    });
    expect(result).toEqual({ lcp: 2400, inp: 180, cls: 0.05 });
  });

  it("parses a string-encoded percentile (CrUX sometimes reports CLS as a string)", () => {
    const result = mapCruxMetrics({
      record: {
        metrics: { cumulative_layout_shift: { percentiles: { p75: "0.08" } } },
      },
    });
    expect(result.cls).toBe(0.08);
  });

  it("returns null for metrics with no data rather than 0", () => {
    const result = mapCruxMetrics({ record: { metrics: {} } });
    expect(result).toEqual({ lcp: null, inp: null, cls: null });
  });

  it("handles a completely empty payload without throwing", () => {
    expect(mapCruxMetrics({})).toEqual({ lcp: null, inp: null, cls: null });
  });
});
