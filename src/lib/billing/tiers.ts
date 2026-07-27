import { Tier } from "@/lib/types";

export interface TierLimits {
  /** Max number of brands. Infinity = unlimited. */
  maxBrands: number;
  /** Allowed scheduled-scan frequencies. */
  scanFrequencies: ("OFF" | "WEEKLY" | "DAILY")[];
  /** Can generate GEO content + run the Fame plan / publishing. */
  contentGeneration: boolean;
  /** Agency features: white-label, PDF export, bulk scans. */
  agency: boolean;
  /** Display price (USD/mo) for the pricing page. */
  price: number;
  label: string;
  blurb: string;
  features: string[];
}

export const TIERS: Record<Tier, TierLimits> = {
  [Tier.STARTER]: {
    maxBrands: 1,
    scanFrequencies: ["OFF", "WEEKLY"],
    contentGeneration: false,
    agency: false,
    price: 0,
    label: "Starter",
    blurb: "Track one brand's AI visibility, for free.",
    features: [
      "1 brand",
      "Weekly scans",
      "Full analyzer (rank, trend, sources)",
      "Gap analysis",
    ],
  },
  [Tier.PRO]: {
    maxBrands: 3,
    scanFrequencies: ["OFF", "WEEKLY", "DAILY"],
    contentGeneration: true,
    agency: false,
    price: 49,
    label: "Pro",
    blurb: "Track, fix, and publish — the full closed loop.",
    features: [
      "3 brands",
      "Daily scans",
      "GEO content generation",
      "Fame Plan + publishing (WordPress/webhook)",
      "AI-suggested prompts",
    ],
  },
  [Tier.AGENCY]: {
    maxBrands: Number.POSITIVE_INFINITY,
    scanFrequencies: ["OFF", "WEEKLY", "DAILY"],
    contentGeneration: true,
    agency: true,
    price: 199,
    label: "Agency",
    blurb: "Manage GEO for unlimited client brands.",
    features: [
      "Unlimited brands",
      "Everything in Pro",
      "White-label PDF reports",
      "Shareable client report links",
      "Bulk scans",
    ],
  },
};

/** The tier for a given (possibly null) subscription. */
export function tierOf(tier: Tier | null | undefined): TierLimits {
  return TIERS[tier ?? Tier.STARTER];
}
