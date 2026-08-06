import { z } from "zod";

import type { LlmMessage } from "@/lib/llm/types";

/** Pure — see the comment on src/lib/content/brief.ts for the split. */

export const claimCandidateSchema = z.object({
  text: z.string().trim().min(5).max(400),
  kind: z.enum(["FACTUAL", "OPINION", "FIRST_PARTY"]),
  riskCategory: z.enum(["MEDICAL", "LEGAL", "FINANCIAL"]).nullable(),
  // Null when the LLM found no matching evidence URL for this claim —
  // src/lib/content/blockers.ts treats a FACTUAL claim with no evidence as
  // UNSOURCED_CLAIM regardless of whether the LLM even tried to attach one.
  evidenceUrl: z.string().trim().max(500).nullable(),
});

export const claimExtractionSchema = z.object({
  claims: z.array(claimCandidateSchema).max(80),
});

export type ClaimCandidate = z.infer<typeof claimCandidateSchema>;
export type ClaimExtractionResult = z.infer<typeof claimExtractionSchema>;

export function buildClaimExtractionMessages(input: {
  plainText: string;
  evidenceUrls: string[];
}): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You extract every distinct factual, opinion, or first-party claim from a draft article.",
        'FACTUAL: a checkable assertion about the world (a statistic, a comparison, a named fact). OPINION: a subjective judgment ("the best," "we recommend"). FIRST_PARTY: something only the brand itself could know (its own product behavior, its own customer data).',
        "Set riskCategory to MEDICAL, LEGAL, or FINANCIAL only when the claim gives advice or asserts facts in that domain that could cause real harm if wrong — otherwise null.",
        "For each claim, set evidenceUrl to the exact URL from the evidence list below that supports it, or null if none of them do — never invent a URL.",
        "Do not extract [SOURCE NEEDED] or [EXPERT NEEDED] placeholders themselves as claims; they are already flagged separately.",
        'Return strict JSON only, matching this shape: {"claims":[{"text":"...","kind":"FACTUAL","riskCategory":null,"evidenceUrl":null}]}.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Available evidence URLs:\n${input.evidenceUrls.map((url) => `- ${url}`).join("\n") || "(none)"}`,
        `Draft text:\n${input.plainText}`,
      ].join("\n\n"),
    },
  ];
}
