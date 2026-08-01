import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { glm } from "@/lib/llm/glm";
import type { LlmMessage } from "@/lib/llm/types";
import {
  brandInputSchema,
  type BrandDiscoveryInput,
  type BrandInput,
} from "@/lib/validation/brand";
import {
  assertPublicWebsiteUrl,
  readPublicWebsite,
  UnsafeWebsiteError,
  type WebsiteSnapshot,
} from "@/lib/discovery/website";

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

function fixtureProfile(input: BrandDiscoveryInput): BrandInput {
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

export async function discoverBrandProfile(
  input: BrandDiscoveryInput,
): Promise<BrandInput> {
  try {
    await assertPublicWebsiteUrl(input.websiteUrl);
  } catch (error) {
    if (error instanceof UnsafeWebsiteError) {
      throw new AppError(400, "UNSAFE_WEBSITE_URL", error.message, {
        websiteUrl: [error.message],
      });
    }
    throw error;
  }

  if (process.env.E2E_DISCOVERY_FIXTURE === "true") {
    return fixtureProfile(input);
  }

  if (!process.env.ZAI_API_KEY) {
    throw new AppError(
      503,
      "AI_NOT_CONFIGURED",
      "Automatic brand research is not configured. Add ZAI_API_KEY and try again.",
    );
  }

  const snapshot = await readPublicWebsite(input.websiteUrl);

  try {
    const result = await glm.generateJson({
      messages: buildDiscoveryMessages(input, snapshot),
      schema: discoveredProfileSchema,
      webSearch: true,
      maxTokens: 1600,
      temperature: 0.1,
    });

    return brandInputSchema.parse({ ...input, ...result.content });
  } catch (error) {
    console.error("Brand discovery failed", error);
    throw new AppError(
      502,
      "DISCOVERY_FAILED",
      "We could not confidently research this company. Check the name and URL, then try again.",
    );
  }
}
