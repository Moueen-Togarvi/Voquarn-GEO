import { z } from "zod";

import type { GenerateJsonInput, LlmMessage } from "@/lib/llm/types";
import {
  brandInputSchema,
  type BrandDiscoveryInput,
  type BrandInput,
} from "@/lib/validation/brand";
import type { WebsiteSnapshot } from "@/lib/discovery/website";

export const discoveredProfileSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10)
    .max(240)
    .describe("One plain-English sentence describing the product"),
  category: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .describe("A specific buyer-facing SaaS product category"),
  competitors: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(80),
        websiteUrl: z.string().url(),
      }),
    )
    .min(2)
    .max(4),
});

export type DiscoveredProfile = z.infer<typeof discoveredProfileSchema>;

export function buildDiscoveryMessages(
  input: BrandDiscoveryInput,
  snapshot: WebsiteSnapshot | null,
): LlmMessage[] {
  const websiteEvidence = snapshot
    ? [
        `Resolved URL: ${snapshot.finalUrl}`,
        `Page title: ${snapshot.title ?? "Not found"}`,
        `Meta description: ${snapshot.description ?? "Not found"}`,
        `Visible website text:\n${snapshot.text || "No readable text found"}`,
      ].join("\n")
    : "The website could not be read directly. Use web search and reliable public pages to research it.";

  return [
    {
      role: "system",
      content: [
        "You are a careful B2B SaaS market researcher.",
        "Research the supplied company with web search and return strict JSON only.",
        "Describe the actual product in one concise sentence and choose a specific buyer-facing category.",
        "Select 2 to 4 current, direct product competitors that solve the same core job for the same buyer.",
        "Use each competitor's official canonical homepage URL.",
        "Never include the target company, its parent company, a marketplace, directory, review site, publication, agency, or generic alternative-list article.",
        "Do not invent facts or companies. Resolve ambiguous brand names using the supplied domain.",
        'Return exactly this shape: {"description":"...","category":"...","competitors":[{"name":"...","websiteUrl":"https://..."}]}.',
      ].join(" "),
    },
    {
      role: "user",
      content: `Company name: ${input.name}\nCompany URL: ${input.websiteUrl}\n\nWebsite evidence:\n${websiteEvidence}`,
    },
  ];
}

/** Deterministic, network-free profile used by Playwright so e2e never depends on a live LLM. */
export function shouldUseDiscoveryFixture(): boolean {
  return process.env.E2E_DISCOVERY_FIXTURE === "true";
}

export function fixtureProfile(input: BrandDiscoveryInput): BrandInput {
  return brandInputSchema.parse({
    ...input,
    description: `${input.name} provides software that helps teams understand and improve their market presence.`,
    category: "AI search visibility software",
    competitors: [
      { name: "Market Signal", websiteUrl: "https://market-signal.example" },
      { name: "Search Scope", websiteUrl: "https://search-scope.example" },
    ],
  });
}

/** The generateJson call the discovery Inngest function makes, minus the provider itself — kept separate so it can be wrapped in withProviderCall there. */
export function buildDiscoveryRequest(
  input: BrandDiscoveryInput,
  snapshot: WebsiteSnapshot | null,
): GenerateJsonInput<DiscoveredProfile> {
  return {
    messages: buildDiscoveryMessages(input, snapshot),
    schema: discoveredProfileSchema,
    webSearch: true,
    maxTokens: 1600,
    temperature: 0.1,
  };
}

export function parseDiscoveredProfile(
  input: BrandDiscoveryInput,
  content: DiscoveredProfile,
): BrandInput {
  return brandInputSchema.parse({ ...input, ...content });
}
