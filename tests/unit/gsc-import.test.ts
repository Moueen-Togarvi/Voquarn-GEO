import { describe, expect, it } from "vitest";

import {
  mapSearchAnalyticsRows,
  trailingImportWindow,
} from "@/lib/providers/gsc/import";

describe("mapSearchAnalyticsRows", () => {
  it("maps the (date, query, page) keys onto named fields", () => {
    const rows = mapSearchAnalyticsRows([
      {
        keys: ["2026-08-01", "ai visibility tool", "https://voquarn.com/"],
        clicks: 12,
        impressions: 340,
        ctr: 0.035,
        position: 8.2,
      },
    ]);
    expect(rows).toEqual([
      {
        date: "2026-08-01",
        query: "ai visibility tool",
        page: "https://voquarn.com/",
        clicks: 12,
        impressions: 340,
        ctr: 0.035,
        position: 8.2,
      },
    ]);
  });

  it("drops rows missing a full (date, query, page) key", () => {
    const rows = mapSearchAnalyticsRows([
      {
        keys: ["2026-08-01", "partial key"],
        clicks: 1,
        impressions: 1,
        ctr: 1,
        position: 1,
      },
    ]);
    expect(rows).toEqual([]);
  });
});

describe("trailingImportWindow", () => {
  it("ends 3 days before now and spans the requested number of days", () => {
    const now = new Date("2026-08-06T12:00:00Z");
    const { startDate, endDate } = trailingImportWindow(5, now);
    expect(endDate).toBe("2026-08-03");
    expect(startDate).toBe("2026-07-29");
  });
});
