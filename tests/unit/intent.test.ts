import { describe, expect, it } from "vitest";

import { classifyIntent } from "@/lib/crawl/intent";

describe("classifyIntent", () => {
  it("classifies a pricing page as commercial", () => {
    expect(
      classifyIntent({
        url: "https://example.com/pricing",
        title: "Pricing — Example",
        headings: [],
      }),
    ).toBe("COMMERCIAL");
  });

  it("classifies a signup page as transactional", () => {
    expect(
      classifyIntent({
        url: "https://example.com/signup",
        title: "Start your free trial",
        headings: [],
      }),
    ).toBe("TRANSACTIONAL");
  });

  it("classifies a login page as navigational", () => {
    expect(
      classifyIntent({
        url: "https://example.com/login",
        title: "Log in",
        headings: [],
      }),
    ).toBe("NAVIGATIONAL");
  });

  it("classifies a how-to blog post as informational by default", () => {
    expect(
      classifyIntent({
        url: "https://example.com/blog/how-ai-search-works",
        title: "How AI Search Works",
        headings: ["What is AI search?", "How it ranks results"],
      }),
    ).toBe("INFORMATIONAL");
  });

  it("checks headings, not just the URL and title", () => {
    expect(
      classifyIntent({
        url: "https://example.com/blog/post",
        title: "A blog post",
        headings: ["Compare our plans"],
      }),
    ).toBe("COMMERCIAL");
  });

  it("is case-insensitive", () => {
    expect(
      classifyIntent({
        url: "https://example.com/PRICING",
        title: null,
        headings: [],
      }),
    ).toBe("COMMERCIAL");
  });
});
