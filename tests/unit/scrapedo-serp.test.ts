import { describe, expect, it } from "vitest";

import {
  buildScrapeDoSerpUrl,
  ScrapeDoClient,
} from "@/lib/providers/scrapedo/client";
import { buildSerpRequest } from "@/lib/providers/scrapedo/serp";

describe("buildSerpRequest", () => {
  it("maps market country, language, and device to Scrape.do parameters", () => {
    expect(
      buildSerpRequest({
        keyword: "best crm",
        country: "PK",
        language: "en-US",
        device: "MOBILE",
      }),
    ).toEqual({
      query: "best crm",
      countryCode: "pk",
      languageCode: "en",
      device: "mobile",
      start: 0,
    });
  });

  it("fails clearly when country is not an ISO alpha-2 code", () => {
    expect(() =>
      buildSerpRequest({
        keyword: "best crm",
        country: "Pakistan",
        language: "en",
        device: "DESKTOP",
      }),
    ).toThrow(/two-letter ISO country code/);
  });
});

describe("ScrapeDoClient", () => {
  it("builds the documented structured Google Search request", () => {
    const url = buildScrapeDoSerpUrl(
      {
        query: "best crm & sales",
        countryCode: "pk",
        languageCode: "en",
        device: "desktop",
      },
      "secret-token",
    );

    expect(url.origin + url.pathname).toBe(
      "https://api.scrape.do/plugin/google/search",
    );
    expect(url.searchParams.get("token")).toBe("secret-token");
    expect(url.searchParams.get("q")).toBe("best crm & sales");
    expect(url.searchParams.get("gl")).toBe("pk");
    expect(url.searchParams.get("hl")).toBe("en");
    expect(url.searchParams.get("device")).toBe("desktop");
    expect(url.searchParams.get("start")).toBe("0");
  });

  it("refuses a network call when the token is missing", async () => {
    const client = new ScrapeDoClient("");
    await expect(
      client.fetchOrganicSerp({
        query: "best crm",
        countryCode: "us",
        languageCode: "en",
        device: "desktop",
      }),
    ).rejects.toThrow(/SCRAPEDO_API_TOKEN/);
  });
});
