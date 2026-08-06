import { describe, expect, it } from "vitest";

import { weekStartOf } from "@/lib/opportunity/week";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("weekStartOf", () => {
  it("returns the same date for a Monday", () => {
    expect(iso(weekStartOf(new Date("2026-08-03T15:00:00.000Z")))).toBe(
      "2026-08-03",
    );
  });

  it("rolls a mid-week date back to Monday", () => {
    expect(iso(weekStartOf(new Date("2026-08-07T09:00:00.000Z")))).toBe(
      "2026-08-03",
    );
  });

  it("wraps a Sunday back to the preceding Monday, not forward", () => {
    expect(iso(weekStartOf(new Date("2026-08-09T23:00:00.000Z")))).toBe(
      "2026-08-03",
    );
  });

  it("crosses a month boundary correctly", () => {
    expect(iso(weekStartOf(new Date("2026-09-01T00:00:00.000Z")))).toBe(
      "2026-08-31",
    );
  });

  it("truncates the time of day to UTC midnight", () => {
    const result = weekStartOf(new Date("2026-08-07T23:59:59.000Z"));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });
});
