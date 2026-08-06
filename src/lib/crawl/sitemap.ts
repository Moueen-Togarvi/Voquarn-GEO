/**
 * Regex-based XML parsing, deliberately — consistent with the same choice
 * already made for HTML in src/lib/discovery/website.ts, and it avoids
 * adding an XML/DOM parsing dependency for what is structurally a very
 * small, well-defined vocabulary (sitemap and sitemap-index documents have
 * exactly two shapes, both flat lists of a handful of known tags).
 */

export type SitemapUrlEntry = {
  loc: string;
  lastmod: string | null;
};

export type ParsedSitemap =
  | { kind: "urlset"; entries: SitemapUrlEntry[] }
  | { kind: "sitemapindex"; entries: SitemapUrlEntry[] };

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return match ? decodeXmlEntities(match[1].trim()) : null;
}

function extractEntries(
  xml: string,
  containerTag: "url" | "sitemap",
): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [];
  const containerPattern = new RegExp(
    `<${containerTag}[^>]*>([\\s\\S]*?)<\\/${containerTag}>`,
    "gi",
  );

  for (const match of xml.matchAll(containerPattern)) {
    const block = match[1];
    const loc = extractTag(block, "loc");
    if (!loc) continue;
    entries.push({ loc, lastmod: extractTag(block, "lastmod") });
  }

  return entries;
}

/**
 * Handles both document shapes a `<sitemap>` reference in robots.txt (or a
 * conventional `/sitemap.xml`) can point at: a `<urlset>` of pages, or a
 * `<sitemapindex>` of further sitemaps to fetch. The caller (huntable via
 * result.kind) decides whether to recurse.
 */
export function parseSitemap(xml: string): ParsedSitemap {
  if (/<sitemapindex[\s>]/i.test(xml)) {
    return { kind: "sitemapindex", entries: extractEntries(xml, "sitemap") };
  }
  return { kind: "urlset", entries: extractEntries(xml, "url") };
}
