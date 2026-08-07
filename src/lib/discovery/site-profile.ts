import {
  DEFAULT_CRAWLER_USER_AGENT,
  fetchPageForCrawl,
} from "@/lib/crawl/fetcher";
import { isPathAllowed, parseRobotsTxt, selectGroup } from "@/lib/crawl/robots";
import { parseSitemap } from "@/lib/crawl/sitemap";
import {
  extractWebsiteSnapshot,
  type WebsiteSnapshot,
} from "@/lib/discovery/website";
import { registrableDomain } from "@/lib/domains/canonical";

const MAX_PROFILE_PAGES = 16;
const MAX_SITEMAPS = 4;
const MAX_SITEMAP_CHILDREN = 4;
const MAX_DISCOVERED_URLS = 5_000;
const MAX_URL_INVENTORY = 200;
const MAX_PAGE_TEXT = 6_000;
const MAX_TOTAL_TEXT = 72_000;

export type WebsitePageKind =
  "HOME" | "PRODUCT_OR_SERVICE" | "BLOG_OR_RESOURCE" | "ABOUT" | "OTHER";

export type WebsitePageSnapshot = WebsiteSnapshot & {
  kind: WebsitePageKind;
};

export type WebsiteProfileSnapshot = {
  requestedUrl: string;
  pages: WebsitePageSnapshot[];
  discoveredUrlCount: number;
  discoveredUrls: string[];
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function extractInternalWebsiteLinks(
  html: string,
  pageUrl: string,
): string[] {
  const page = new URL(pageUrl);
  const rootDomain = registrableDomain(page.hostname);
  const links = new Set<string>();
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = decodeHtml(match[1]).trim();
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      const url = new URL(href, page);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (registrableDomain(url.hostname) !== rootDomain) continue;
      url.hash = "";
      url.search = "";
      links.add(url.toString());
    } catch {
      // Ignore malformed links; the rest of the site is still useful evidence.
    }
  }

  return [...links];
}

export function classifyWebsitePage(url: string): WebsitePageKind {
  const path = new URL(url).pathname.toLowerCase().replace(/\/$/, "");
  if (!path) return "HOME";
  if (
    /\/(blog|blogs|resource|resources|insight|insights|guide|guides|article|articles|news|learn)(\/|$)/.test(
      path,
    )
  ) {
    return "BLOG_OR_RESOURCE";
  }
  if (
    /\/(product|products|service|services|solution|solutions|feature|features|use-case|use-cases|pricing|platform)(\/|$)/.test(
      path,
    )
  ) {
    return "PRODUCT_OR_SERVICE";
  }
  if (/\/(about|company|customers|case-studies|case-study)(\/|$)/.test(path)) {
    return "ABOUT";
  }
  return "OTHER";
}

function candidateScore(url: string): number {
  const parsed = new URL(url);
  const kind = classifyWebsitePage(url);
  const depth = parsed.pathname.split("/").filter(Boolean).length;
  const kindScore: Record<WebsitePageKind, number> = {
    HOME: 1_000,
    PRODUCT_OR_SERVICE: 800,
    BLOG_OR_RESOURCE: 650,
    ABOUT: 500,
    OTHER: 200,
  };
  return kindScore[kind] - Math.min(depth, 10) * 5;
}

export function selectRepresentativeWebsiteUrls(
  urls: string[],
  requestedUrl: string,
  limit = MAX_PROFILE_PAGES,
): string[] {
  const rootDomain = registrableDomain(new URL(requestedUrl).hostname);
  const normalized = new Map<string, string>();

  for (const value of [requestedUrl, ...urls]) {
    try {
      const url = new URL(value, requestedUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (registrableDomain(url.hostname) !== rootDomain) continue;
      url.hash = "";
      url.search = "";
      const key = `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
      normalized.set(key, url.toString());
    } catch {
      // Ignore malformed sitemap/link entries.
    }
  }

  const ranked = [...normalized.values()].sort(
    (a, b) => candidateScore(b) - candidateScore(a) || a.localeCompare(b),
  );
  const buckets = new Map<WebsitePageKind, string[]>();
  for (const url of ranked) {
    const kind = classifyWebsitePage(url);
    buckets.set(kind, [...(buckets.get(kind) ?? []), url]);
  }

  // Keep the evidence balanced: product/service pages explain the offer,
  // while resource pages reveal the subjects and buyer questions the company
  // actually writes about. Filling by global score afterwards uses all spare
  // capacity without letting a 5,000-post blog crowd out core product pages.
  const selected = new Set<string>();
  const quotas: Array<[WebsitePageKind, number]> = [
    ["HOME", 1],
    ["PRODUCT_OR_SERVICE", 7],
    ["BLOG_OR_RESOURCE", 5],
    ["ABOUT", 2],
    ["OTHER", 2],
  ];
  for (const [kind, quota] of quotas) {
    for (const url of (buckets.get(kind) ?? []).slice(0, quota)) {
      if (selected.size < limit) selected.add(url);
    }
  }
  for (const url of ranked) {
    if (selected.size >= limit) break;
    selected.add(url);
  }
  return [...selected];
}

async function discoverSitemapUrls(
  origin: string,
  sitemapLocations: string[],
): Promise<string[]> {
  const discovered = new Set<string>();
  const rootDomain = registrableDomain(new URL(origin).hostname);
  const locations = sitemapLocations.length
    ? sitemapLocations
    : [new URL("/sitemap.xml", origin).toString()];

  for (const sitemapUrl of locations.slice(0, MAX_SITEMAPS)) {
    try {
      if (registrableDomain(new URL(sitemapUrl).hostname) !== rootDomain)
        continue;
    } catch {
      continue;
    }
    const outcome = await fetchPageForCrawl(sitemapUrl, {
      allowedContentTypes: null,
    });
    if (outcome.kind !== "ok" || outcome.result.httpStatus >= 400) continue;

    const parsed = parseSitemap(outcome.result.html);
    if (parsed.kind === "urlset") {
      for (const entry of parsed.entries) {
        if (discovered.size >= MAX_DISCOVERED_URLS) break;
        discovered.add(entry.loc);
      }
      continue;
    }

    for (const child of parsed.entries.slice(0, MAX_SITEMAP_CHILDREN)) {
      try {
        if (registrableDomain(new URL(child.loc).hostname) !== rootDomain)
          continue;
      } catch {
        continue;
      }
      const childOutcome = await fetchPageForCrawl(child.loc, {
        allowedContentTypes: null,
      });
      if (childOutcome.kind !== "ok" || childOutcome.result.httpStatus >= 400)
        continue;
      const childParsed = parseSitemap(childOutcome.result.html);
      if (childParsed.kind !== "urlset") continue;
      for (const entry of childParsed.entries) {
        if (discovered.size >= MAX_DISCOVERED_URLS) break;
        discovered.add(entry.loc);
      }
    }
  }

  return [...discovered];
}

/**
 * Builds a bounded, robots-aware research snapshot of the supplied website.
 * This is intentionally a representative discovery crawl rather than the
 * product's persistent Phase-4 technical crawl: it gathers enough service,
 * audience, and editorial evidence to ground onboarding without writing page
 * snapshots before the project exists.
 */
export async function readPublicWebsiteProfile(
  websiteUrl: string,
): Promise<WebsiteProfileSnapshot> {
  const homeOutcome = await fetchPageForCrawl(websiteUrl);
  if (homeOutcome.kind !== "ok" || homeOutcome.result.httpStatus >= 400) {
    return {
      requestedUrl: websiteUrl,
      pages: [],
      discoveredUrlCount: 0,
      discoveredUrls: [],
    };
  }

  const home = homeOutcome.result;
  const origin = new URL(home.finalUrl).origin;
  const robotsOutcome = await fetchPageForCrawl(
    new URL("/robots.txt", origin).toString(),
    { allowedContentTypes: null },
  );
  const robotsBody =
    robotsOutcome.kind === "ok" && robotsOutcome.result.httpStatus < 400
      ? robotsOutcome.result.html
      : "";
  const robots = parseRobotsTxt(robotsBody);
  const robotsGroup = selectGroup(robots, DEFAULT_CRAWLER_USER_AGENT);

  const [sitemapUrls, homeLinks] = await Promise.all([
    discoverSitemapUrls(origin, robots.sitemaps),
    Promise.resolve(extractInternalWebsiteLinks(home.html, home.finalUrl)),
  ]);
  const candidates = selectRepresentativeWebsiteUrls(
    [...sitemapUrls, ...homeLinks],
    home.finalUrl,
  ).filter((url) => {
    const parsed = new URL(url);
    return isPathAllowed(robotsGroup, parsed.pathname).allowed;
  });

  const pages: WebsitePageSnapshot[] = [];
  let totalText = 0;
  for (const batchStart of Array.from(
    { length: Math.ceil(candidates.length / 3) },
    (_, index) => index * 3,
  )) {
    const outcomes = await Promise.all(
      candidates.slice(batchStart, batchStart + 3).map(async (url) => {
        if (new URL(url).toString() === new URL(home.finalUrl).toString())
          return homeOutcome;
        return fetchPageForCrawl(url);
      }),
    );

    for (const outcome of outcomes) {
      if (outcome.kind !== "ok" || outcome.result.httpStatus >= 400) continue;
      const snapshot = extractWebsiteSnapshot(
        outcome.result.html,
        outcome.result.finalUrl,
      );
      const remaining = MAX_TOTAL_TEXT - totalText;
      if (remaining <= 0) break;
      snapshot.text = snapshot.text.slice(
        0,
        Math.min(MAX_PAGE_TEXT, remaining),
      );
      totalText += snapshot.text.length;
      pages.push({
        ...snapshot,
        kind: classifyWebsitePage(snapshot.finalUrl),
      });
    }
    if (totalText >= MAX_TOTAL_TEXT) break;
  }

  const discoveredUrls = selectRepresentativeWebsiteUrls(
    [...sitemapUrls, ...homeLinks],
    home.finalUrl,
    MAX_URL_INVENTORY,
  );

  return {
    requestedUrl: websiteUrl,
    pages,
    discoveredUrlCount: new Set([...sitemapUrls, ...homeLinks]).size,
    discoveredUrls,
  };
}
