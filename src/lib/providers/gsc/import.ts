import type { SearchAnalyticsRow } from "@/lib/providers/gsc/client";

export type MappedPerformanceRow = {
  date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/** Pure: drops any row that doesn't carry all three requested dimensions rather than guessing at a partial key. */
export function mapSearchAnalyticsRows(
  rows: SearchAnalyticsRow[],
): MappedPerformanceRow[] {
  return rows
    .filter((row) => row.keys.length === 3 && row.keys.every(Boolean))
    .map((row) => ({
      date: row.keys[0] as string,
      query: row.keys[1] as string,
      page: row.keys[2] as string,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GSC's own data typically lags 2-3 days, and can still shift for a few
 * days after that as Google finalizes it — re-importing a trailing window
 * on every run (rather than a rolling "since last import" cursor) is what
 * makes gscDailyImport's upsert on the (siteId, date, query, page) unique
 * key self-correcting for that delay. See docs/events.md.
 */
export function trailingImportWindow(
  days = 5,
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}
