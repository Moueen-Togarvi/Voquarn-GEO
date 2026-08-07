import { describe, expect, it } from "vitest";
import { buildDiscoveryMessages } from "@/lib/discovery/brand-profile";
import {
  assertPublicWebsiteUrl,
  extractWebsiteSnapshot,
  UnsafeWebsiteError,
} from "@/lib/discovery/website";
import {
  classifyWebsitePage,
  extractInternalWebsiteLinks,
  selectRepresentativeWebsiteUrls,
} from "@/lib/discovery/site-profile";

describe("automatic brand discovery", () => {
  it("builds research instructions from only company name and URL", () => {
    const messages = buildDiscoveryMessages(
      { name: "Voquarn", websiteUrl: "https://voquarn.com" },
      {
        requestedUrl: "https://voquarn.com",
        discoveredUrlCount: 4,
        discoveredUrls: [
          "https://voquarn.com/",
          "https://voquarn.com/product",
          "https://voquarn.com/blog",
        ],
        pages: [
          {
            finalUrl: "https://voquarn.com",
            title: "Voquarn GEO",
            description: "AI visibility for SaaS teams",
            text: "Measure how AI engines understand and mention your company.",
            kind: "HOME",
          },
        ],
      },
    );

    expect(messages[0]?.content).toContain("first analyze");
    expect(messages[0]?.content).toContain("2 to 4 current, direct");
    expect(messages[0]?.content).toContain("Never include the target company");
    expect(messages[1]?.content).toContain("Company name: Voquarn");
    expect(messages[1]?.content).toContain("Voquarn GEO");
  });

  it("extracts only same-site HTTP links and removes tracking fragments", () => {
    const links = extractInternalWebsiteLinks(
      `<a href="/services?utm_source=x#top">Services</a>
       <a href="https://blog.voquarn.com/guides/geo">Guide</a>
       <a href="https://example.com/other">Other</a>
       <a href="mailto:hello@voquarn.com">Email</a>`,
      "https://www.voquarn.com/",
    );

    expect(links).toEqual([
      "https://www.voquarn.com/services",
      "https://blog.voquarn.com/guides/geo",
    ]);
  });

  it("classifies and balances service and blog evidence", () => {
    expect(classifyWebsitePage("https://acme.com/services/consulting")).toBe(
      "PRODUCT_OR_SERVICE",
    );
    expect(classifyWebsitePage("https://acme.com/blog/aeo-guide")).toBe(
      "BLOG_OR_RESOURCE",
    );

    const selected = selectRepresentativeWebsiteUrls(
      [
        ...Array.from(
          { length: 20 },
          (_, index) => `https://acme.com/blog/post-${index}`,
        ),
        "https://acme.com/services/strategy",
        "https://acme.com/product/platform",
      ],
      "https://acme.com",
      6,
    );
    expect(selected).toContain("https://acme.com/");
    expect(selected).toContain("https://acme.com/services/strategy");
    expect(selected.some((url) => url.includes("/blog/"))).toBe(true);
  });

  it("extracts useful visible evidence without scripts", () => {
    const result = extractWebsiteSnapshot(
      '<html><head><title> Acme </title><meta name="description" content="Team software"></head><body><script>secret()</script><h1>Hello &amp; welcome</h1></body></html>',
      "https://acme.com",
    );

    expect(result.title).toBe("Acme");
    expect(result.description).toBe("Team software");
    expect(result.text).toContain("Hello & welcome");
    expect(result.text).not.toContain("secret");
  });

  // Private-address classification itself is covered exhaustively in
  // tests/unit/net-ip.test.ts; these confirm assertPublicWebsiteUrl actually
  // uses it end to end.
  it("rejects localhost and private IP website targets", async () => {
    await expect(
      assertPublicWebsiteUrl("http://localhost:3000"),
    ).rejects.toBeInstanceOf(UnsafeWebsiteError);
    await expect(
      assertPublicWebsiteUrl("http://127.0.0.1"),
    ).rejects.toBeInstanceOf(UnsafeWebsiteError);
    await expect(assertPublicWebsiteUrl("http://[::1]")).rejects.toBeInstanceOf(
      UnsafeWebsiteError,
    );
  });

  it("returns the validated address for a public literal IP, for pinning", async () => {
    await expect(assertPublicWebsiteUrl("http://8.8.8.8")).resolves.toEqual({
      address: "8.8.8.8",
    });
  });
});
