import { z } from "zod";

import type { GenerateJsonInput, LlmMessage } from "@/lib/llm/types";

const PROMPT_TYPES = [
  "CATEGORY",
  "COMPARISON",
  "USE_CASE",
  "BRAND_SPECIFIC",
] as const;

export const generatedPromptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        text: z
          .string()
          .trim()
          .min(10)
          .max(300)
          .describe(
            "A realistic buyer question, phrased the way a real person would ask an AI assistant",
          ),
        type: z.enum(PROMPT_TYPES),
      }),
    )
    .min(15)
    .max(30),
});

export type GeneratedPrompts = z.infer<typeof generatedPromptsSchema>;

export type PromptGenerationInput = {
  brand: {
    name: string;
    description: string;
    category: string;
    services: string[];
    audiences: string[];
    painPoints: string[];
    contentThemes: string[];
    differentiators: string[];
  };
  competitors: { name: string }[];
  market: { language: string; country: string };
};

export function buildPromptGenerationMessages(
  input: PromptGenerationInput,
): LlmMessage[] {
  const competitorList =
    input.competitors.length > 0
      ? input.competitors.map((competitor) => competitor.name).join(", ")
      : "none known";

  return [
    {
      role: "system",
      content: [
        "You build high-signal AEO/GEO monitoring prompts that reveal whether AI answer engines understand, recommend, compare, and cite a business in its real market niche.",
        "Each question is something a real prospective buyer would actually type into an AI assistant while researching this category — never a question that names the target company as the obvious right answer.",
        "Use web search to learn current terminology and buying considerations in this exact niche, but ground every prompt in the supplied first-party profile. Do not drift into adjacent categories.",
        "Produce 20 to 28 non-duplicative questions with a balanced spread across four types:",
        "CATEGORY — a general question about the product category with no company named.",
        "COMPARISON — a question comparing two or more companies in the category, potentially including the target or a competitor by name.",
        "USE_CASE — a question about solving a specific problem or use case in this category.",
        "BRAND_SPECIFIC — a question that names the target company directly (e.g. asking what it does, or whether it fits a scenario).",
        "Cover multiple funnel stages: problem discovery, category education, shortlist/recommendation, alternatives, evaluation, trust/proof, pricing or implementation when relevant, and final selection.",
        "Distribute prompts across the listed services, audiences, pain points, and content themes. Use concrete buyer language; avoid repetitive templates, SEO keyword fragments, vague questions, and claims not present in the profile.",
        "At least half of CATEGORY and USE_CASE questions must be non-branded so the benchmark can measure organic category visibility.",
        `Phrase every question in ${input.market.language} for a buyer in ${input.market.country}.`,
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Company: ${input.brand.name}`,
        `What it does: ${input.brand.description}`,
        `Category: ${input.brand.category}`,
        `Products and services: ${input.brand.services.join("; ") || "Not identified"}`,
        `Target audiences: ${input.brand.audiences.join("; ") || "Not identified"}`,
        `Buyer pain points: ${input.brand.painPoints.join("; ") || "Not identified"}`,
        `Existing content themes: ${input.brand.contentThemes.join("; ") || "None identified"}`,
        `Claimed differentiators: ${input.brand.differentiators.join("; ") || "None identified"}`,
        `Known competitors: ${competitorList}`,
      ].join("\n"),
    },
  ];
}

export function buildPromptGenerationRequest(
  input: PromptGenerationInput,
): GenerateJsonInput<GeneratedPrompts> {
  return {
    messages: buildPromptGenerationMessages(input),
    schema: generatedPromptsSchema,
    webSearch: true,
    maxTokens: 4500,
    temperature: 0.6,
  };
}

/** Deterministic, network-free prompt set used by Playwright — see E2E_DISCOVERY_FIXTURE in src/lib/discovery/brand-profile.ts, reused here for the same reason. */
export function shouldUsePromptGenerationFixture(): boolean {
  return process.env.E2E_DISCOVERY_FIXTURE === "true";
}

export function fixturePrompts(input: PromptGenerationInput): GeneratedPrompts {
  const category = input.brand.category.toLowerCase();
  const competitor = input.competitors[0]?.name ?? "the leading alternative";

  return {
    prompts: [
      {
        text: `What is the best ${category} for a growing team?`,
        type: "CATEGORY",
      },
      {
        text: `What should I look for when evaluating ${category}?`,
        type: "CATEGORY",
      },
      { text: `How much does ${category} typically cost?`, type: "CATEGORY" },
      {
        text: `What are the top-rated tools in the ${category} space?`,
        type: "CATEGORY",
      },
      {
        text: `Which ${category} tool is easiest to set up?`,
        type: "CATEGORY",
      },
      {
        text: `How does ${input.brand.name} compare to ${competitor}?`,
        type: "COMPARISON",
      },
      {
        text: `${input.brand.name} vs ${competitor}: which is better for a startup?`,
        type: "COMPARISON",
      },
      {
        text: `What are the differences between ${input.brand.name} and other ${category} tools?`,
        type: "COMPARISON",
      },
      {
        text: `Is ${input.brand.name} better than ${competitor} for enterprise use?`,
        type: "COMPARISON",
      },
      {
        text: `How do I choose between ${input.brand.name} and its competitors?`,
        type: "COMPARISON",
      },
      {
        text: `What's the best way to measure results with ${category}?`,
        type: "USE_CASE",
      },
      {
        text: `How can a small team get started with ${category}?`,
        type: "USE_CASE",
      },
      {
        text: `What integrations should I look for in ${category}?`,
        type: "USE_CASE",
      },
      { text: `What does ${input.brand.name} do?`, type: "BRAND_SPECIFIC" },
      {
        text: `Is ${input.brand.name} a good fit for enterprise teams?`,
        type: "BRAND_SPECIFIC",
      },
      {
        text: `What do people say about ${input.brand.name}?`,
        type: "BRAND_SPECIFIC",
      },
    ],
  };
}
