import type { OpportunityKind } from "@/generated/prisma/enums";

/**
 * Deterministic — same (kind, topic, competitor, keyword) always produces
 * the same key, which is what Opportunity's `@@unique([brandId, dedupeKey])`
 * relies on to stop a dismissed opportunity from being recreated the next
 * time detection runs. Never include anything that changes between runs
 * (a score, a timestamp) — that would defeat the point.
 */
export function buildDedupeKey(
  kind: OpportunityKind,
  parts: {
    topicId?: string | null;
    competitorId?: string | null;
    keywordId?: string | null;
  },
): string {
  return [
    kind,
    parts.topicId ?? "-",
    parts.competitorId ?? "-",
    parts.keywordId ?? "-",
  ].join(":");
}
