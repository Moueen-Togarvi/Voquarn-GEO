import { describe, expect, it } from "vitest";

import { parseSitemap } from "@/lib/crawl/sitemap";

describe("parseSitemap", () => {
  it("parses a urlset with loc and lastmod", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/</loc>
          <lastmod>2026-08-01</lastmod>
        </url>
        <url>
          <loc>https://example.com/about</loc>
          <lastmod>2026-07-15</lastmod>
        </url>
      </urlset>`;

    const result = parseSitemap(xml);
    expect(result.kind).toBe("urlset");
    expect(result.entries).toEqual([
      { loc: "https://example.com/", lastmod: "2026-08-01" },
      { loc: "https://example.com/about", lastmod: "2026-07-15" },
    ]);
  });

  it("treats a missing lastmod as null rather than dropping the entry", () => {
    const xml = `<urlset><url><loc>https://example.com/no-date</loc></url></urlset>`;
    const result = parseSitemap(xml);
    expect(result.entries).toEqual([
      { loc: "https://example.com/no-date", lastmod: null },
    ]);
  });

  it("skips entries with no loc", () => {
    const xml = `<urlset><url><lastmod>2026-08-01</lastmod></url></urlset>`;
    expect(parseSitemap(xml).entries).toEqual([]);
  });

  it("parses a sitemapindex distinctly from a urlset", () => {
    const xml = `<sitemapindex>
      <sitemap>
        <loc>https://example.com/sitemap-posts.xml</loc>
        <lastmod>2026-08-01</lastmod>
      </sitemap>
      <sitemap>
        <loc>https://example.com/sitemap-pages.xml</loc>
      </sitemap>
    </sitemapindex>`;

    const result = parseSitemap(xml);
    expect(result.kind).toBe("sitemapindex");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      loc: "https://example.com/sitemap-posts.xml",
      lastmod: "2026-08-01",
    });
  });

  it("decodes XML entities in loc values", () => {
    const xml = `<urlset><url><loc>https://example.com/a&amp;b</loc></url></urlset>`;
    expect(parseSitemap(xml).entries[0]?.loc).toBe("https://example.com/a&b");
  });

  it("returns an empty entry list for an empty urlset", () => {
    expect(parseSitemap("<urlset></urlset>").entries).toEqual([]);
  });
});
