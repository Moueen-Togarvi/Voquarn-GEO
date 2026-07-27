import { z } from "zod";
import { completeText, extractJson, FAST_MODEL } from "@/lib/ai";

/** A generated buyer-intent prompt plus its category. */
export interface GeneratedPrompt {
  text: string;
  category: PromptCategory;
}

export type PromptCategory =
  "discovery" | "comparison" | "evaluation" | "recommendation";

const CATEGORIES: PromptCategory[] = [
  "discovery",
  "comparison",
  "evaluation",
  "recommendation",
];

export interface BrandContext {
  name: string;
  industry: string;
  description?: string | null;
  competitors: string[];
}

// Validate the model's JSON output before we trust it.
const promptSchema = z.object({
  text: z.string().min(3),
  category: z.enum(["discovery", "comparison", "evaluation", "recommendation"]),
});
const promptsSchema = z.array(promptSchema);

function buildSystemPrompt(): string {
  return [
    "You generate realistic buyer-intent search prompts that real people type",
    "into AI assistants (ChatGPT, Claude, Gemini, Perplexity) when researching",
    "products in a given industry. The prompts must sound natural and span four",
    "categories:",
    '- "discovery": broad ("best [industry] tools in 2026")',
    '- "comparison": head-to-head ("[competitor] vs alternatives")',
    '- "evaluation": assessing a specific brand ("is [brand] good for X")',
    '- "recommendation": use-case driven ("what [industry] tool should I use for X")',
    "",
    "Return ONLY a valid JSON array of objects with keys `text` and `category`.",
    "No markdown, no prose, no code fences.",
  ].join("\n");
}

function buildUserPrompt(brand: BrandContext): string {
  const competitors =
    brand.competitors.length > 0
      ? brand.competitors.join(", ")
      : "(none provided)";
  return [
    `Brand: ${brand.name}`,
    `Industry: ${brand.industry}`,
    brand.description ? `Description: ${brand.description}` : "",
    `Known competitors: ${competitors}`,
    "",
    "Generate 15-20 prompts covering all four categories. Naturally reference",
    "the brand and competitors where it fits a real user's phrasing.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generate 15-20 realistic buyer-intent prompts for a brand using Claude.
 * Falls back to a template set if the API call or parsing fails, so a scan can
 * always proceed.
 */
export async function generatePrompts(
  brand: BrandContext,
): Promise<GeneratedPrompt[]> {
  try {
    const raw = await completeText({
      system: buildSystemPrompt(),
      prompt: buildUserPrompt(brand),
      model: FAST_MODEL,
      maxTokens: 2048,
    });

    const parsed = extractJson<unknown>(raw);
    const result = promptsSchema.safeParse(parsed);
    if (result.success && result.data.length > 0) {
      return result.data;
    }
    console.warn(
      "[generator] Claude output failed validation, using fallback prompts.",
    );
  } catch (error) {
    console.warn(
      "[generator] prompt generation failed, using fallback prompts:",
      error instanceof Error ? error.message : error,
    );
  }

  return fallbackPrompts(brand);
}

/** Deterministic template prompts used when the API is unavailable. */
export function fallbackPrompts(brand: BrandContext): GeneratedPrompt[] {
  const { industry, name } = brand;
  const competitor = brand.competitors[0] ?? "competitors";

  const templates: GeneratedPrompt[] = [
    {
      text: `What are the best ${industry} tools in 2026?`,
      category: "discovery",
    },
    {
      text: `Top ${industry} platforms for small businesses`,
      category: "discovery",
    },
    {
      text: `Most popular ${industry} software right now`,
      category: "discovery",
    },
    {
      text: `${name} vs ${competitor}: which is better?`,
      category: "comparison",
    },
    {
      text: `${competitor} alternatives worth considering`,
      category: "comparison",
    },
    {
      text: `How does ${name} compare to other ${industry} tools?`,
      category: "comparison",
    },
    { text: `Is ${name} good for a growing team?`, category: "evaluation" },
    { text: `Is ${name} worth the price?`, category: "evaluation" },
    { text: `What are the pros and cons of ${name}?`, category: "evaluation" },
    {
      text: `What ${industry} tool should I use for a startup?`,
      category: "recommendation",
    },
    {
      text: `Recommend a ${industry} solution for enterprise`,
      category: "recommendation",
    },
    {
      text: `Which ${industry} platform is best for beginners?`,
      category: "recommendation",
    },
  ];

  return templates;
}

export { CATEGORIES };

/**
 * Suggest likely competitor brand names for a brand, from its industry +
 * description. Used by the onboarding wizard to pre-fill competitors. Returns
 * [] on failure (non-critical).
 */
export async function suggestCompetitors(brand: {
  name: string;
  industry: string;
  description?: string | null;
}): Promise<string[]> {
  try {
    const raw = await completeText({
      model: FAST_MODEL,
      maxTokens: 300,
      system:
        "You name real, well-known competitor brands for a given product. " +
        "Return ONLY a JSON array of 4-6 competitor names (strings). No prose.",
      prompt: [
        `Brand: ${brand.name}`,
        `Industry: ${brand.industry}`,
        brand.description ? `Description: ${brand.description}` : "",
        "",
        "List its main competitors (exclude the brand itself).",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    const parsed = extractJson<unknown>(raw);
    const result = z.array(z.string().trim().min(1)).safeParse(parsed);
    if (!result.success) return [];
    return result.data
      .filter((c) => c.toLowerCase() !== brand.name.toLowerCase())
      .slice(0, 6);
  } catch {
    return [];
  }
}

// ── AI-suggested prompts (analyzer inbox) ──

export interface SuggestedPrompt {
  text: string;
  category: PromptCategory;
  /** Rough estimated monthly search volume (derived from a high/med/low bucket). */
  volume: number;
  /** Why this prompt matters for the brand's AI visibility. */
  reason: string;
}

const VOLUME_BY_BUCKET: Record<"high" | "medium" | "low", number> = {
  high: 5000,
  medium: 1000,
  low: 200,
};

const suggestionSchema = z.object({
  text: z.string().min(3),
  category: z.enum(["discovery", "comparison", "evaluation", "recommendation"]),
  bucket: z.enum(["high", "medium", "low"]),
  reason: z.string().min(3),
});
const suggestionsSchema = z.array(suggestionSchema);

/**
 * Propose NEW high-intent prompts the brand isn't tracking yet, each with a
 * rough volume bucket and a reason. Used for the analyzer's suggestions inbox.
 * Returns [] on failure (non-critical feature).
 */
export async function suggestPrompts(
  brand: BrandContext,
  existing: string[] = [],
): Promise<SuggestedPrompt[]> {
  try {
    const raw = await completeText({
      model: FAST_MODEL,
      maxTokens: 1500,
      system: [
        "You suggest NEW buyer-intent prompts a brand should track for AI",
        "visibility, beyond the ones it already tracks. For each, estimate a",
        'search-volume bucket ("high" | "medium" | "low") and give a one-line',
        "reason. Return ONLY a JSON array of objects with keys text, category",
        "(discovery|comparison|evaluation|recommendation), bucket, reason.",
        "No markdown, no prose.",
      ].join("\n"),
      prompt: [
        `Brand: ${brand.name} (${brand.industry})`,
        brand.description ? `Description: ${brand.description}` : "",
        `Competitors: ${brand.competitors.join(", ") || "(none)"}`,
        existing.length > 0
          ? `Already tracking (do NOT repeat these):\n- ${existing.slice(0, 30).join("\n- ")}`
          : "",
        "",
        "Suggest 6-10 fresh prompts.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const parsed = extractJson<unknown>(raw);
    const result = suggestionsSchema.safeParse(parsed);
    if (!result.success) return [];

    // Drop any that collide with existing prompts (case-insensitive).
    const existingLower = new Set(existing.map((e) => e.toLowerCase().trim()));
    return result.data
      .filter((s) => !existingLower.has(s.text.toLowerCase().trim()))
      .map((s) => ({
        text: s.text,
        category: s.category,
        volume: VOLUME_BY_BUCKET[s.bucket],
        reason: s.reason,
      }));
  } catch (error) {
    console.warn(
      "[generator] suggestPrompts failed:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
