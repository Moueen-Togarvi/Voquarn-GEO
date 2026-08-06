import { z } from "zod";

import type { LlmMessage } from "@/lib/llm/types";

/**
 * Pure — schema and message-building only, no DB, no provider call. The
 * actual generateStructured() invocation lives in the Inngest function
 * (src/lib/inngest/functions/content.ts), same split as
 * src/lib/discovery/brand-profile.ts's buildDiscoveryMessages vs. where
 * brand-discovery.ts actually calls withProviderCall.
 *
 * This IS the brief — see the ResearchPacket model comment in schema.prisma
 * for why there's no separate Brief table.
 */

export const briefOutlineSectionSchema = z.object({
  heading: z.string().trim().min(3).max(120),
  level: z.union([z.literal(2), z.literal(3)]),
  notes: z.string().trim().max(500),
  coverageGoal: z.string().trim().max(300),
});

export const briefInternalLinkSchema = z.object({
  url: z.string().trim().max(500),
  title: z.string().trim().max(200),
  reason: z.string().trim().max(200),
});

export const briefSchema = z.object({
  audience: z.string().trim().max(300),
  intent: z.string().trim().max(300),
  angle: z.string().trim().max(300),
  outline: z.array(briefOutlineSectionSchema).min(2).max(12),
  firstPartyInputsNeeded: z.array(z.string().trim().max(200)).max(10),
  internalLinkCandidates: z.array(briefInternalLinkSchema).max(10),
  visualSuggestions: z.array(z.string().trim().max(200)).max(6),
  schemaRecommendation: z.string().trim().max(60).optional(),
});

export type BriefResult = z.infer<typeof briefSchema>;

export type BriefEvidenceItem = {
  url: string;
  title: string | null;
  snippet: string | null;
};

export function buildBriefMessages(input: {
  contentTitle: string;
  brandName: string;
  brandCategory: string;
  brandTone: string | null;
  keywordText: string | null;
  targetWordCount: number | null;
  opportunitySummary: string | null;
  evidence: BriefEvidenceItem[];
  internalLinkCandidates: BriefEvidenceItem[];
}): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are an SEO content strategist writing a structured brief for a human writer/editor — not the final article.",
        "Ground every part of the brief in the evidence provided. Never invent statistics, sources, or facts not present in the evidence.",
        "The outline must have 2 to 12 sections, each a clear H2 or H3 heading with a one-sentence coverage goal.",
        "internalLinkCandidates must only use URLs from the internal link evidence provided — never invent a URL.",
        'Return strict JSON only, matching this shape: {"audience":"...","intent":"...","angle":"...","outline":[{"heading":"...","level":2,"notes":"...","coverageGoal":"..."}],"firstPartyInputsNeeded":["..."],"internalLinkCandidates":[{"url":"...","title":"...","reason":"..."}],"visualSuggestions":["..."],"schemaRecommendation":"Article"}.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Brand: ${input.brandName} (${input.brandCategory})`,
        input.brandTone ? `Brand tone: ${input.brandTone}` : null,
        `Content title: ${input.contentTitle}`,
        input.keywordText ? `Target keyword: ${input.keywordText}` : null,
        input.targetWordCount
          ? `Target length: roughly ${input.targetWordCount} words`
          : null,
        input.opportunitySummary
          ? `Why this content: ${input.opportunitySummary}`
          : null,
        `Evidence:\n${input.evidence
          .map(
            (item) =>
              `- ${item.title ?? item.url} (${item.url})${item.snippet ? `: ${item.snippet}` : ""}`,
          )
          .join("\n")}`,
        `Internal link candidates:\n${input.internalLinkCandidates
          .map((item) => `- ${item.title ?? item.url} (${item.url})`)
          .join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
