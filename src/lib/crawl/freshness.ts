export type FreshnessInput = {
  sitemapLastmod?: string | null;
  metaPublished?: string | null;
  metaModified?: string | null;
  jsonLdPublished?: string | null;
  jsonLdModified?: string | null;
  httpLastModified?: string | null;
};

export type FreshnessResult = {
  publishedAt: Date | null;
  modifiedAt: Date | null;
  /** 0-1 — how much of the total possible signal weight was actually present, not a claim about accuracy. */
  confidence: number;
};

type WeightedDate = { date: Date; weight: number };

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function push(
  signals: WeightedDate[],
  value: string | null | undefined,
  weight: number,
) {
  const date = parseDate(value);
  if (date) signals.push({ date, weight });
}

// JSON-LD is what a page author deliberately, structurally declared —
// weighted highest. Sitemap lastmod and the HTTP header are both easy to
// leave stale or generate mechanically (some CMSs bump every page's
// lastmod on every deploy) — weighted lowest.
const MODIFIED_WEIGHTS = {
  jsonLd: 0.35,
  meta: 0.25,
  sitemap: 0.25,
  header: 0.15,
};
const PUBLISHED_WEIGHTS = { jsonLd: 0.6, meta: 0.4 };
const MAX_MODIFIED_WEIGHT = Object.values(MODIFIED_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
);
const MAX_PUBLISHED_WEIGHT = Object.values(PUBLISHED_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
);

function strongest(signals: WeightedDate[]): Date | null {
  return [...signals].sort((a, b) => b.weight - a.weight)[0]?.date ?? null;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Combines every available freshness signal into one best-guess published/
 * modified date pair plus a confidence score — multiple signals with
 * confidence, never one header trusted as truth. See the plan's own
 * correction on this: a single Last-Modified header is not freshness.
 *
 * The highest-weighted *present* signal wins as the actual date (not an
 * average — averaging a 2024 JSON-LD date with a 2026 sitemap date would
 * produce a date nobody actually claimed). Confidence instead reflects how
 * much of the total possible signal weight backs that date, so "we're
 * fairly sure" and "we're guessing from one weak header" read differently
 * even when they happen to agree on the same day.
 */
export function resolveFreshness(input: FreshnessInput): FreshnessResult {
  const publishedSignals: WeightedDate[] = [];
  push(publishedSignals, input.jsonLdPublished, PUBLISHED_WEIGHTS.jsonLd);
  push(publishedSignals, input.metaPublished, PUBLISHED_WEIGHTS.meta);

  const modifiedSignals: WeightedDate[] = [];
  push(modifiedSignals, input.jsonLdModified, MODIFIED_WEIGHTS.jsonLd);
  push(modifiedSignals, input.metaModified, MODIFIED_WEIGHTS.meta);
  push(modifiedSignals, input.sitemapLastmod, MODIFIED_WEIGHTS.sitemap);
  push(modifiedSignals, input.httpLastModified, MODIFIED_WEIGHTS.header);

  const publishedAt = strongest(publishedSignals);
  const modifiedAt = strongest(modifiedSignals) ?? publishedAt;

  if (!modifiedAt) {
    return { publishedAt, modifiedAt, confidence: 0 };
  }

  const modifiedWeight = modifiedSignals.reduce((sum, s) => sum + s.weight, 0);
  const publishedWeight = publishedSignals.reduce(
    (sum, s) => sum + s.weight,
    0,
  );
  const confidence = round(
    Math.min(
      1,
      (modifiedWeight / MAX_MODIFIED_WEIGHT) * 0.8 +
        (publishedWeight / MAX_PUBLISHED_WEIGHT) * 0.2,
    ),
  );

  return { publishedAt, modifiedAt, confidence };
}
