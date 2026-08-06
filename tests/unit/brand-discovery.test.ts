import { describe, expect, it } from "vitest";
import { buildDiscoveryMessages } from "@/lib/discovery/brand-profile";
import {
  assertPublicWebsiteUrl,
  extractWebsiteSnapshot,
  UnsafeWebsiteError,
} from "@/lib/discovery/website";

describe("automatic brand discovery", () => {
  it("builds research instructions from only company name and URL", () => {
    const messages = buildDiscoveryMessages(
      { name: "Voquarn", websiteUrl: "https://voquarn.com" },
      {
        finalUrl: "https://voquarn.com",
        title: "Voquarn GEO",
        description: "AI visibility for SaaS teams",
        text: "Measure how AI engines understand and mention your company.",
      },
    );

    expect(messages[0]?.content).toContain("2 to 4 current, direct");
    expect(messages[0]?.content).toContain("Never include the target company");
    expect(messages[1]?.content).toContain("Company name: Voquarn");
    expect(messages[1]?.content).toContain("Voquarn GEO");
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
