// Client-safe engine display metadata. Deliberately does NOT import from
// @/lib/types (the Prisma-generated enum), because that pulls the Prisma
// runtime — which uses node:async_hooks — into client bundles. The string
// values here match the Prisma `Engine` enum exactly.

export type EngineName = "OPENAI" | "CLAUDE" | "GEMINI" | "PERPLEXITY";

/** Display labels + fixed order for engines (categorical color order is fixed). */
export const ENGINE_ORDER: EngineName[] = [
  "OPENAI",
  "CLAUDE",
  "GEMINI",
  "PERPLEXITY",
];

export const ENGINE_LABELS: Record<EngineName, string> = {
  OPENAI: "ChatGPT",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
  PERPLEXITY: "Perplexity",
};

/** Fixed chart color per engine — maps to shadcn --chart-N tokens (never cycled). */
export const ENGINE_COLOR_VAR: Record<EngineName, string> = {
  OPENAI: "var(--chart-1)",
  CLAUDE: "var(--chart-2)",
  GEMINI: "var(--chart-3)",
  PERPLEXITY: "var(--chart-4)",
};
