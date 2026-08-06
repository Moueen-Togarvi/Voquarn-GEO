import { describe, expect, it } from "vitest";

import { registrableDomain, subdomain } from "@/lib/domains/canonical";

describe("registrableDomain", () => {
  it("strips subdomains down to the registrable domain", () => {
    expect(registrableDomain("https://www.example.com/path")).toBe(
      "example.com",
    );
    expect(registrableDomain("https://shop.example.com")).toBe("example.com");
  });

  it("handles multi-part public suffixes correctly", () => {
    expect(registrableDomain("https://shop.example.co.uk")).toBe(
      "example.co.uk",
    );
    expect(registrableDomain("https://example.co.uk")).toBe("example.co.uk");
  });

  it("does not collapse distinct companies hosted on the same PSL private domain", () => {
    // Without allowPrivateDomains, both of these would incorrectly resolve
    // to "github.io", merging two unrelated companies into one "domain".
    expect(registrableDomain("https://acme.github.io")).toBe("acme.github.io");
    expect(registrableDomain("https://widgetco.github.io")).toBe(
      "widgetco.github.io",
    );
  });

  it("returns an empty string for unparsable input rather than throwing", () => {
    expect(registrableDomain("not a url###")).toBe("");
    expect(registrableDomain("localhost")).toBe("");
  });
});

describe("subdomain", () => {
  it("extracts the label(s) below the registrable domain", () => {
    expect(subdomain("https://shop.example.co.uk")).toBe("shop");
    expect(subdomain("https://example.co.uk")).toBeNull();
  });
});
