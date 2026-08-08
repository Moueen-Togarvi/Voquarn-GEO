import type { CompetitorTier } from "@/generated/prisma/enums";

/** Untiered (pre-migration) rows display under Top — see the schema migration note on Competitor.tier in prisma/schema.prisma. */
export function groupCompetitorsByTier<
  T extends { tier: CompetitorTier | null },
>(competitors: T[]): Record<CompetitorTier, T[]> {
  const groups: Record<CompetitorTier, T[]> = {
    TOP: [],
    MIDDLE: [],
    BOTTOM: [],
  };
  for (const competitor of competitors) {
    groups[competitor.tier ?? "TOP"].push(competitor);
  }
  return groups;
}
