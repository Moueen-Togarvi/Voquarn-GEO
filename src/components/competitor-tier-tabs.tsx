"use client";

import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import type { CompetitorTier } from "@/generated/prisma/enums";

const TIER_LABELS: Record<CompetitorTier, string> = {
  TOP: "Top",
  MIDDLE: "Middle",
  BOTTOM: "Bottom",
};

export type TierPanel = {
  tier: CompetitorTier;
  count: number;
  content: ReactNode;
};

/** Top/Middle/Bottom toggle for the expanded competitor set — the only other Tabs usage in this codebase is src/components/content-editor.tsx, whose CSS this mirrors under its own class names. */
export function CompetitorTierTabs({ panels }: { panels: TierPanel[] }) {
  const firstTier = panels[0]?.tier;
  if (!firstTier) return null;

  return (
    <Tabs.Root defaultValue={firstTier} className="competitor-tier-tabs-root">
      <Tabs.List className="competitor-tier-tabs" aria-label="Competitor tiers">
        {panels.map((panel) => (
          <Tabs.Trigger
            key={panel.tier}
            value={panel.tier}
            className="competitor-tier-tab"
          >
            {TIER_LABELS[panel.tier]} ({panel.count})
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {panels.map((panel) => (
        <Tabs.Content
          key={panel.tier}
          value={panel.tier}
          className="competitor-tier-tab-panel"
        >
          {panel.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
