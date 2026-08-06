import { z } from "zod";

import type { LlmMessage } from "@/lib/llm/types";
import type { BriefEvidenceItem } from "@/lib/content/brief";

/** Pure — see the comment on src/lib/content/brief.ts for the split. */

export const sectionDraftSchema = z.object({
  paragraphs: z.array(z.string().trim().min(20)).min(1).max(8),
});

export type SectionDraftResult = z.infer<typeof sectionDraftSchema>;

export function buildSectionMessages(input: {
  brandName: string;
  brandTone: string | null;
  brandGuidelines: string | null;
  approvedSamples: string[];
  contentTitle: string;
  sectionHeading: string;
  sectionNotes: string;
  coverageGoal: string;
  evidence: BriefEvidenceItem[];
  precedingHeadings: string[];
}): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You write one section of a longer article at a time, in the brand's voice, grounded strictly in the evidence given.",
        "Never invent statistics, quotes, or facts not present in the evidence. If a claim needs a source you don't have, write it as a placeholder: [SOURCE NEEDED].",
        "If a section genuinely needs first-party input only the brand can provide (a specific number, a customer story), write [EXPERT NEEDED] rather than inventing it.",
        "Write only the body paragraphs for this one section — do not repeat the heading, do not write other sections, do not add a conclusion unless this section IS the conclusion.",
        'Return strict JSON only, matching this shape: {"paragraphs":["...", "..."]}.',
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Brand: ${input.brandName}`,
        input.brandTone ? `Tone: ${input.brandTone}` : null,
        input.brandGuidelines ? `Guidelines: ${input.brandGuidelines}` : null,
        input.approvedSamples.length > 0
          ? `Approved voice samples:\n${input.approvedSamples.map((s) => `- ${s}`).join("\n")}`
          : null,
        `Article title: ${input.contentTitle}`,
        input.precedingHeadings.length > 0
          ? `Preceding sections already written: ${input.precedingHeadings.join(", ")}`
          : null,
        `This section's heading: ${input.sectionHeading}`,
        `This section's coverage goal: ${input.coverageGoal}`,
        input.sectionNotes ? `Notes: ${input.sectionNotes}` : null,
        `Evidence available for this section:\n${input.evidence
          .map(
            (item) =>
              `- ${item.title ?? item.url} (${item.url})${item.snippet ? `: ${item.snippet}` : ""}`,
          )
          .join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
