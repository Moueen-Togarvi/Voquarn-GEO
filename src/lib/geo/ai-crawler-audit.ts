import { isAllowed } from "@/lib/crawl/robots";

/**
 * The crawlers that actually feed AI answers — see A3 in the implementation
 * plan. A large share of sites accidentally block the ones that matter
 * (Google-Extended in particular is easy to conflate with plain Googlebot
 * and disallow by accident) while leaving classic search crawlers alone;
 * surfacing that mismatch explicitly is one of the most defensible "GEO"
 * findings this product can produce, and it costs nothing once robots.txt
 * is already fetched for crawl politeness.
 */
export const AI_CRAWLER_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Bingbot",
] as const;

export type AiCrawlerBotName = (typeof AI_CRAWLER_BOTS)[number];

export type AiCrawlerAuditEntry = {
  botName: AiCrawlerBotName;
  allowed: boolean;
  evidence: string;
};

/**
 * Pure — audits one already-fetched robots.txt body against every known AI
 * bot user-agent at a representative path ("/"). A missing robots.txt is a
 * real, common case and means no restriction exists, not an error.
 */
export function auditAiCrawlerAccess(
  robotsBody: string | null,
): AiCrawlerAuditEntry[] {
  return AI_CRAWLER_BOTS.map((botName) => {
    if (!robotsBody) {
      return {
        botName,
        allowed: true,
        evidence: "No robots.txt found — nothing restricts this bot.",
      };
    }

    const result = isAllowed(robotsBody, botName, "/");
    const evidence = result.matchedRule
      ? `Matched rule "${result.matchedRule}" for user-agent "${botName}".`
      : `No rule matched user-agent "${botName}"; default allow applies.`;

    return { botName, allowed: result.allowed, evidence };
  });
}
