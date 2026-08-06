import { describe, expect, it } from "vitest";

import { findMatchingGscSite } from "@/lib/providers/gsc/client";

describe("findMatchingGscSite", () => {
  it("prefers an exact domain-property match", () => {
    const sites = [
      { siteUrl: "https://blog.voquarn.com/", permissionLevel: "siteOwner" },
      { siteUrl: "sc-domain:voquarn.com", permissionLevel: "siteOwner" },
    ];
    expect(findMatchingGscSite(sites, "voquarn.com")?.siteUrl).toBe(
      "sc-domain:voquarn.com",
    );
  });

  it("falls back to a URL property containing the domain", () => {
    const sites = [
      { siteUrl: "https://voquarn.com/", permissionLevel: "siteOwner" },
    ];
    expect(findMatchingGscSite(sites, "voquarn.com")?.siteUrl).toBe(
      "https://voquarn.com/",
    );
  });

  it("falls back to the first available property when nothing matches", () => {
    const sites = [
      { siteUrl: "https://unrelated.example/", permissionLevel: "siteOwner" },
    ];
    expect(findMatchingGscSite(sites, "voquarn.com")?.siteUrl).toBe(
      "https://unrelated.example/",
    );
  });

  it("returns null for an empty site list", () => {
    expect(findMatchingGscSite([], "voquarn.com")).toBeNull();
  });

  it("is case-insensitive", () => {
    const sites = [
      { siteUrl: "sc-domain:Voquarn.com", permissionLevel: "siteOwner" },
    ];
    expect(findMatchingGscSite(sites, "VOQUARN.COM")?.siteUrl).toBe(
      "sc-domain:Voquarn.com",
    );
  });
});
