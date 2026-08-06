import { describe, expect, it } from "vitest";

import { resolveFreshness } from "@/lib/crawl/freshness";

describe("resolveFreshness", () => {
  it("returns null dates and zero confidence when no signal is present", () => {
    const result = resolveFreshness({});
    expect(result.publishedAt).toBeNull();
    expect(result.modifiedAt).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("prefers the JSON-LD modified date over weaker signals", () => {
    const result = resolveFreshness({
      jsonLdModified: "2026-07-20",
      metaModified: "2026-01-01",
      sitemapLastmod: "2025-12-01",
      httpLastModified: "2025-11-01",
    });
    expect(result.modifiedAt?.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  it("falls back to the publishedAt when no modified signal exists", () => {
    const result = resolveFreshness({ jsonLdPublished: "2026-01-05" });
    expect(result.modifiedAt?.toISOString().slice(0, 10)).toBe("2026-01-05");
  });

  it("has higher confidence when more signals are present and agree", () => {
    const rich = resolveFreshness({
      jsonLdModified: "2026-07-20",
      metaModified: "2026-07-20",
      sitemapLastmod: "2026-07-20",
      httpLastModified: "2026-07-20",
    });
    const thin = resolveFreshness({ httpLastModified: "2026-07-20" });
    expect(rich.confidence).toBeGreaterThan(thin.confidence);
  });

  it("ignores unparsable date strings rather than throwing", () => {
    const result = resolveFreshness({ jsonLdModified: "not-a-date" });
    expect(result.modifiedAt).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("caps confidence at 1", () => {
    const result = resolveFreshness({
      jsonLdPublished: "2026-01-01",
      metaPublished: "2026-01-01",
      jsonLdModified: "2026-07-20",
      metaModified: "2026-07-20",
      sitemapLastmod: "2026-07-20",
      httpLastModified: "2026-07-20",
    });
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
