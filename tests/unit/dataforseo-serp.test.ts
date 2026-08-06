import { describe, expect, it } from "vitest";

import {
  buildSerpRequest,
  resolveLocationCode,
} from "@/lib/providers/dataforseo/serp";

describe("resolveLocationCode", () => {
  it("resolves known markets case-insensitively", () => {
    expect(resolveLocationCode("US")).toBe(2840);
    expect(resolveLocationCode("gb")).toBe(2826);
  });

  it("throws a clear error for an unmapped country rather than guessing", () => {
    expect(() => resolveLocationCode("ZZ")).toThrow(
      /No DataForSEO location code/,
    );
  });
});

describe("buildSerpRequest", () => {
  it("maps a market device enum to DataForSEO's lowercase device string", () => {
    expect(
      buildSerpRequest({
        keyword: "best crm",
        country: "US",
        language: "en",
        device: "MOBILE",
      }),
    ).toMatchObject({
      device: "mobile",
      locationCode: 2840,
      languageCode: "en",
    });

    expect(
      buildSerpRequest({
        keyword: "best crm",
        country: "US",
        language: "en",
        device: "DESKTOP",
      }),
    ).toMatchObject({ device: "desktop" });
  });
});
