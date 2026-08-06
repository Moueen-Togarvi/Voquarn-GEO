import { describe, expect, it } from "vitest";

import {
  isAllowed,
  isPathAllowed,
  parseRobotsTxt,
  selectGroup,
} from "@/lib/crawl/robots";

describe("parseRobotsTxt", () => {
  it("parses a single group with disallow, allow, and crawl-delay", () => {
    const parsed = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /admin/",
        "Allow: /admin/public/",
        "Crawl-delay: 2",
      ].join("\n"),
    );
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]).toMatchObject({
      userAgents: ["*"],
      disallow: ["/admin/"],
      allow: ["/admin/public/"],
      crawlDelay: 2,
    });
  });

  it("groups consecutive User-agent lines with no rules between them", () => {
    const parsed = parseRobotsTxt(
      [
        "User-agent: GPTBot",
        "User-agent: ClaudeBot",
        "Disallow: /private/",
      ].join("\n"),
    );
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]?.userAgents).toEqual(["gptbot", "claudebot"]);
  });

  it("starts a new group when User-agent reappears after rules", () => {
    const parsed = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /admin/",
        "User-agent: GPTBot",
        "Disallow: /",
      ].join("\n"),
    );
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[1]).toMatchObject({
      userAgents: ["gptbot"],
      disallow: ["/"],
    });
  });

  it("collects Sitemap lines regardless of group boundaries", () => {
    const parsed = parseRobotsTxt(
      [
        "Sitemap: https://example.com/sitemap.xml",
        "User-agent: *",
        "Disallow:",
      ].join("\n"),
    );
    expect(parsed.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("treats an empty Disallow value as no restriction", () => {
    const parsed = parseRobotsTxt(["User-agent: *", "Disallow:"].join("\n"));
    expect(parsed.groups[0]?.disallow).toEqual([]);
  });

  it("ignores comments and blank lines", () => {
    const parsed = parseRobotsTxt(
      [
        "# this is a comment",
        "",
        "User-agent: * # inline comment",
        "Disallow: /admin/",
      ].join("\n"),
    );
    expect(parsed.groups[0]?.userAgents).toEqual(["*"]);
    expect(parsed.groups[0]?.disallow).toEqual(["/admin/"]);
  });
});

describe("selectGroup", () => {
  const parsed = parseRobotsTxt(
    [
      "User-agent: *",
      "Disallow: /admin/",
      "User-agent: GPTBot",
      "Disallow: /",
    ].join("\n"),
  );

  it("prefers an exact user-agent match over the wildcard group", () => {
    expect(selectGroup(parsed, "GPTBot")?.disallow).toEqual(["/"]);
  });

  it("is case-insensitive", () => {
    expect(selectGroup(parsed, "gptbot")?.disallow).toEqual(["/"]);
  });

  it("falls back to the wildcard group for an unlisted agent", () => {
    expect(selectGroup(parsed, "SomeOtherBot")?.disallow).toEqual(["/admin/"]);
  });

  it("returns null when there is no matching or wildcard group", () => {
    const noWildcard = parseRobotsTxt("User-agent: GPTBot\nDisallow: /");
    expect(selectGroup(noWildcard, "ClaudeBot")).toBeNull();
  });
});

describe("isPathAllowed", () => {
  it("allows everything when there is no matching group", () => {
    expect(isPathAllowed(null, "/anything").allowed).toBe(true);
  });

  it("disallows a path matching a Disallow rule", () => {
    const parsed = parseRobotsTxt("User-agent: *\nDisallow: /admin/");
    const group = selectGroup(parsed, "*");
    expect(isPathAllowed(group, "/admin/settings").allowed).toBe(false);
    expect(isPathAllowed(group, "/blog/post").allowed).toBe(true);
  });

  it("prefers the longer (more specific) matching rule", () => {
    const parsed = parseRobotsTxt(
      ["User-agent: *", "Disallow: /admin/", "Allow: /admin/public/"].join(
        "\n",
      ),
    );
    const group = selectGroup(parsed, "*");
    expect(isPathAllowed(group, "/admin/public/page").allowed).toBe(true);
    expect(isPathAllowed(group, "/admin/private/page").allowed).toBe(false);
  });

  it("prefers Allow over Disallow on an exact-length tie", () => {
    const parsed = parseRobotsTxt(
      ["User-agent: *", "Disallow: /x/", "Allow: /x/"].join("\n"),
    );
    const group = selectGroup(parsed, "*");
    expect(isPathAllowed(group, "/x/").allowed).toBe(true);
  });

  it("supports wildcard (*) patterns", () => {
    const parsed = parseRobotsTxt("User-agent: *\nDisallow: /*.pdf");
    const group = selectGroup(parsed, "*");
    expect(isPathAllowed(group, "/files/report.pdf").allowed).toBe(false);
    expect(isPathAllowed(group, "/files/report.html").allowed).toBe(true);
  });

  it("supports end-anchored ($) patterns", () => {
    const parsed = parseRobotsTxt("User-agent: *\nDisallow: /page$");
    const group = selectGroup(parsed, "*");
    expect(isPathAllowed(group, "/page").allowed).toBe(false);
    expect(isPathAllowed(group, "/page/nested").allowed).toBe(true);
  });
});

describe("isAllowed", () => {
  it("blocks a specific AI bot while allowing the general crawler", () => {
    const robots = [
      "User-agent: *",
      "Disallow:",
      "User-agent: GPTBot",
      "Disallow: /",
    ].join("\n");

    expect(isAllowed(robots, "GPTBot", "/blog/post").allowed).toBe(false);
    expect(isAllowed(robots, "Voquarn-GEO", "/blog/post").allowed).toBe(true);
  });
});
