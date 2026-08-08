import { z } from "zod";

import { websiteUrlSchema } from "@/lib/validation/brand";

/**
 * Validates the competitor-expansion write path, not the original 2-4
 * discovery competitors — brandInputSchema.competitors (validation/brand.ts)
 * intentionally keeps its own min(2).max(4) cap for that fast path. This
 * schema governs the separate, larger tiered set instead.
 */
export const expandedCompetitorItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  websiteUrl: websiteUrlSchema,
  country: z.string().trim().length(2).toUpperCase().nullable().optional(),
});

export const expandedCompetitorBatchSchema = z.object({
  tier: z.enum(["TOP", "MIDDLE", "BOTTOM"]),
  competitors: z.array(expandedCompetitorItemSchema).min(0).max(20),
});

export type ExpandedCompetitorItem = z.infer<
  typeof expandedCompetitorItemSchema
>;
export type ExpandedCompetitorBatch = z.infer<
  typeof expandedCompetitorBatchSchema
>;
