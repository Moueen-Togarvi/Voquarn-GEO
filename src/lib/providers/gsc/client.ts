export type SearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Search Console's `searchanalytics.query`, dimensioned by (date, query,
 * page) to match SearchPerformanceRow's grain. Structurally complete
 * against Google's documented API but never exercised against a live
 * Search Console property in this environment — verify before relying on
 * it in production, same caveat as src/lib/providers/gsc/oauth.ts.
 */
export async function querySearchAnalytics(input: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<SearchAnalyticsRow[]> {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: ["date", "query", "page"],
      rowLimit: 25000,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Search Console query failed (${response.status}).`);
  }

  const payload = (await response.json()) as { rows?: SearchAnalyticsRow[] };
  return payload.rows ?? [];
}

export type GscSiteEntry = {
  siteUrl: string;
  permissionLevel: string;
};

/** The properties the connected Google account has Search Console access to — used right after OAuth completes to pick which one matches the brand's own domain. */
export async function listGscSites(
  accessToken: string,
): Promise<GscSiteEntry[]> {
  const response = await fetch(
    "https://www.googleapis.com/webmasters/v3/sites",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (!response.ok) {
    throw new Error(`Search Console sites.list failed (${response.status}).`);
  }

  const payload = (await response.json()) as { siteEntry?: GscSiteEntry[] };
  return payload.siteEntry ?? [];
}

/**
 * GSC properties are registered either as `sc-domain:example.com` (a
 * domain property, covering every subdomain and scheme) or a full URL like
 * `https://example.com/`. Prefers an exact domain-property match, then a
 * URL containing the domain, then falls back to the first available
 * property rather than failing outright — a human can always change it
 * later; blocking the whole connection on a naming mismatch is worse.
 */
export function findMatchingGscSite(
  sites: GscSiteEntry[],
  domain: string,
): GscSiteEntry | null {
  const normalized = domain.toLowerCase();

  const domainProperty = sites.find(
    (site) => site.siteUrl.toLowerCase() === `sc-domain:${normalized}`,
  );
  if (domainProperty) return domainProperty;

  const urlMatch = sites.find((site) =>
    site.siteUrl.toLowerCase().includes(normalized),
  );
  if (urlMatch) return urlMatch;

  return sites[0] ?? null;
}
