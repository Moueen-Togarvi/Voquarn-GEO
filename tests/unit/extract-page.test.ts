import { describe, expect, it } from "vitest";

import { extractPage } from "@/lib/crawl/extract";

describe("extractPage", () => {
  it("extracts title, description, and canonical URL", () => {
    const html = `<html><head>
      <title>Best AI Visibility Tool | Voquarn</title>
      <meta name="description" content="Track your brand across AI answers.">
      <link rel="canonical" href="https://voquarn.com/product">
    </head><body></body></html>`;

    const result = extractPage(html, "https://voquarn.com/product?ref=x");
    expect(result.title).toBe("Best AI Visibility Tool | Voquarn");
    expect(result.description).toBe("Track your brand across AI answers.");
    expect(result.canonicalUrl).toBe("https://voquarn.com/product");
  });

  it("falls back to og:description when a plain description is absent", () => {
    const html = `<meta property="og:description" content="OG fallback text.">`;
    expect(extractPage(html, "https://example.com/").description).toBe(
      "OG fallback text.",
    );
  });

  it("extracts headings in document order with their levels", () => {
    const html = `<h1>Main Title</h1><p>text</p><h2>Sub A</h2><h2>Sub B</h2>`;
    const result = extractPage(html, "https://example.com/");
    expect(result.headings).toEqual([
      { level: 1, text: "Main Title" },
      { level: 2, text: "Sub A" },
      { level: 2, text: "Sub B" },
    ]);
  });

  it("counts words from visible text only, excluding scripts and styles", () => {
    const html = `<body><script>var x = "one two three four";</script><style>.a{color:red}</style><p>Five real words here now</p></body>`;
    const result = extractPage(html, "https://example.com/");
    expect(result.wordCount).toBe(5);
  });

  it("classifies links as internal or external relative to the page's own host", () => {
    const html = `
      <a href="/pricing">Pricing</a>
      <a href="https://example.com/about">About</a>
      <a href="https://competitor.example/">Competitor</a>
      <a href="#section">Anchor only</a>
      <a href="mailto:hi@example.com">Email</a>
    `;
    const result = extractPage(html, "https://example.com/home");
    expect(result.internalLinks).toBe(2);
    expect(result.externalLinks).toBe(1);
  });

  it("counts media elements by type", () => {
    const html = `<img src="a.png"><img src="b.png"><video src="c.mp4"></video><audio src="d.mp3"></audio>`;
    const result = extractPage(html, "https://example.com/");
    expect(result.mediaCounts).toEqual({ images: 2, videos: 1, audio: 1 });
  });

  it("parses valid JSON-LD blocks and extracts datePublished/dateModified", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Article","datePublished":"2026-01-05","dateModified":"2026-07-20"}
    </script>`;
    const result = extractPage(html, "https://example.com/");
    expect(result.jsonLd).toHaveLength(1);
    expect(result.dateSignals.jsonLdPublished).toBe("2026-01-05");
    expect(result.dateSignals.jsonLdModified).toBe("2026-07-20");
  });

  it("skips a malformed JSON-LD block instead of throwing", () => {
    const html = `<script type="application/ld+json">{ not valid json </script>
      <script type="application/ld+json">{"@type":"Article","datePublished":"2026-02-01"}</script>`;
    const result = extractPage(html, "https://example.com/");
    expect(result.jsonLd).toHaveLength(1);
    expect(result.dateSignals.jsonLdPublished).toBe("2026-02-01");
  });

  it("reads article:published_time / article:modified_time meta tags", () => {
    const html = `
      <meta property="article:published_time" content="2026-03-01T00:00:00Z">
      <meta property="article:modified_time" content="2026-06-15T00:00:00Z">
    `;
    const result = extractPage(html, "https://example.com/");
    expect(result.dateSignals.metaPublished).toBe("2026-03-01T00:00:00Z");
    expect(result.dateSignals.metaModified).toBe("2026-06-15T00:00:00Z");
  });

  it("handles a page with none of the optional signals present", () => {
    const result = extractPage(
      "<html><body><p>Hi</p></body></html>",
      "https://example.com/",
    );
    expect(result.title).toBeNull();
    expect(result.description).toBeNull();
    expect(result.canonicalUrl).toBeNull();
    expect(result.jsonLd).toEqual([]);
  });
});
