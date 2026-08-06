import { describe, expect, it } from "vitest";

import {
  AI_CRAWLER_BOTS,
  auditAiCrawlerAccess,
} from "@/lib/geo/ai-crawler-audit";

describe("auditAiCrawlerAccess", () => {
  it("reports every known bot as allowed when there is no robots.txt", () => {
    const results = auditAiCrawlerAccess(null);
    expect(results).toHaveLength(AI_CRAWLER_BOTS.length);
    expect(results.every((entry) => entry.allowed)).toBe(true);
  });

  it("flags a specifically blocked bot while leaving others allowed", () => {
    const robots = [
      "User-agent: GPTBot",
      "Disallow: /",
      "User-agent: *",
      "Disallow:",
    ].join("\n");
    const results = auditAiCrawlerAccess(robots);

    const gptBot = results.find((entry) => entry.botName === "GPTBot");
    expect(gptBot?.allowed).toBe(false);

    const claudeBot = results.find((entry) => entry.botName === "ClaudeBot");
    expect(claudeBot?.allowed).toBe(true);
  });

  it("catches the common accidental Google-Extended block", () => {
    const robots = ["User-agent: Google-Extended", "Disallow: /"].join("\n");
    const results = auditAiCrawlerAccess(robots);
    const googleExtended = results.find(
      (entry) => entry.botName === "Google-Extended",
    );
    expect(googleExtended?.allowed).toBe(false);
  });

  it("includes evidence naming the matched rule", () => {
    const robots = ["User-agent: PerplexityBot", "Disallow: /"].join("\n");
    const results = auditAiCrawlerAccess(robots);
    const perplexity = results.find(
      (entry) => entry.botName === "PerplexityBot",
    );
    expect(perplexity?.evidence).toContain("PerplexityBot");
  });
});
