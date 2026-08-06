/**
 * Regex-based HTML extraction — the same deliberate choice already made in
 * src/lib/discovery/website.ts, extended here to also pull headings, links,
 * media counts, canonical URL, JSON-LD blocks, and date signals. A small
 * amount of entity-decoding/tag-stripping logic is duplicated from that
 * file rather than shared, since extracting a shared module for ~10 lines
 * of stable text-formatting helpers wasn't worth the cross-module coupling.
 */

export type Heading = { level: 1 | 2 | 3 | 4 | 5 | 6; text: string };

export type MediaCounts = { images: number; videos: number; audio: number };

export type JsonLdBlock = Record<string, unknown>;

export type DateSignals = {
  metaPublished: string | null;
  metaModified: string | null;
  jsonLdPublished: string | null;
  jsonLdModified: string | null;
};

export type ExtractedPage = {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  headings: Heading[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  mediaCounts: MediaCounts;
  jsonLd: JsonLdBlock[];
  dateSignals: DateSignals;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!match) return null;
  const cleaned = decodeHtmlEntities(match)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned || null;
}

function matchMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/:/g, "\\:");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractHeadings(html: string): Heading[] {
  const headings: Heading[] = [];
  const pattern = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const match of html.matchAll(pattern)) {
    const level = Number(match[1]) as Heading["level"];
    const text = decodeHtmlEntities(stripTags(match[2]))
      .replace(/\s+/g, " ")
      .trim();
    if (text) headings.push({ level, text });
  }
  return headings;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function classifyLinks(
  html: string,
  pageUrl: string,
): { internal: number; external: number } {
  let internal = 0;
  let external = 0;
  const pageHost = safeHostname(pageUrl);

  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = decodeHtmlEntities(match[1]).trim();
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
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:")
        continue;
      if (pageHost && resolved.hostname.toLowerCase() === pageHost) {
        internal += 1;
      } else {
        external += 1;
      }
    } catch {
      // Unresolvable href — skip rather than guess which bucket it belongs in.
    }
  }

  return { internal, external };
}

function countMedia(html: string): MediaCounts {
  return {
    images: (html.match(/<img\b[^>]*>/gi) ?? []).length,
    videos: (html.match(/<video\b[^>]*>/gi) ?? []).length,
    audio: (html.match(/<audio\b[^>]*>/gi) ?? []).length,
  };
}

function extractCanonicalUrl(html: string): string | null {
  const match =
    html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    ) ??
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i,
    );
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function extractJsonLd(html: string): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];
  const pattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") blocks.push(item as JsonLdBlock);
      }
    } catch {
      // Malformed JSON-LD — skip this block, not the whole extraction.
    }
  }

  return blocks;
}

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractDateSignals(html: string, jsonLd: JsonLdBlock[]): DateSignals {
  const metaPublished =
    matchMetaContent(html, "article:published_time") ??
    matchMetaContent(html, "datePublished");
  const metaModified =
    matchMetaContent(html, "article:modified_time") ??
    matchMetaContent(html, "dateModified");

  let jsonLdPublished: string | null = null;
  let jsonLdModified: string | null = null;
  for (const block of jsonLd) {
    jsonLdPublished ??= firstString(block.datePublished);
    jsonLdModified ??= firstString(block.dateModified);
  }

  return { metaPublished, metaModified, jsonLdPublished, jsonLdModified };
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const jsonLd = extractJsonLd(html);
  const links = classifyLinks(html, pageUrl);
  const text = decodeHtmlEntities(stripTags(html)).replace(/\s+/g, " ").trim();

  return {
    title: extractTitle(html),
    description:
      matchMetaContent(html, "description") ??
      matchMetaContent(html, "og:description"),
    canonicalUrl: extractCanonicalUrl(html),
    headings: extractHeadings(html),
    wordCount: countWords(text),
    internalLinks: links.internal,
    externalLinks: links.external,
    mediaCounts: countMedia(html),
    jsonLd,
    dateSignals: extractDateSignals(html, jsonLd),
  };
}
