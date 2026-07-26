import { completeText, SMART_MODEL } from "@/lib/ai";

export type ContentFormat = "markdown" | "qa" | "snippet";

export interface GeneratedContent {
  title: string;
  content: string;
  format: ContentFormat;
  /** Optional JSON-LD schema string, ready to paste into a <script> tag. */
  schema?: string;
}

export interface ContentBrand {
  name: string;
  domain: string;
  industry: string;
  description?: string | null;
}

/** Shared GEO writing guidance — fact-dense, neutral, structured for citation. */
const GEO_SYSTEM = [
  "You write Generative Engine Optimization (GEO) content: factual, neutral,",
  "and fact-dense so AI assistants trust and cite it. Avoid marketing hype and",
  "superlatives. Use clear headings, direct answers up front, short paragraphs,",
  "and structured lists/tables. Never fabricate specific numbers, prices, or",
  "features — describe capabilities generically when specifics are unknown.",
].join(" ");

/**
 * A full "Brand vs Competitor" comparison article in markdown: objective,
 * fact-dense, with a comparison table and an FAQ section.
 */
export async function generateComparisonArticle(
  brand: ContentBrand,
  competitor: string,
  promptContext?: string,
): Promise<GeneratedContent> {
  const content = await completeText({
    model: SMART_MODEL,
    maxTokens: 3000,
    system: GEO_SYSTEM,
    prompt: [
      `Write an objective comparison article: "${brand.name} vs ${competitor}".`,
      `Brand: ${brand.name} (${brand.industry})${brand.description ? ` — ${brand.description}` : ""}.`,
      promptContext
        ? `Written to help with the query: "${promptContext}".`
        : "",
      "",
      "Structure:",
      "1. A one-paragraph direct answer to who each is best for.",
      "2. A markdown comparison table (dimensions like use case, ideal team",
      "   size, key strengths). Use neutral, non-committal cells where you lack",
      "   verified facts.",
      "3. Short sections on each product's strengths.",
      "4. A short FAQ (3-4 Q&A) covering common buyer questions.",
      "",
      "Return only the markdown article.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return {
    title: `${brand.name} vs ${competitor}`,
    content: content.trim(),
    format: "markdown",
  };
}

/**
 * Q&A pairs answering the buyer-intent prompts the brand is missing from, plus
 * a matching JSON-LD FAQPage schema.
 */
export async function generateFAQ(
  brand: ContentBrand,
  prompts: string[],
): Promise<GeneratedContent> {
  const questionList = prompts
    .slice(0, 8)
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const content = await completeText({
    model: SMART_MODEL,
    maxTokens: 2500,
    system: GEO_SYSTEM,
    prompt: [
      `Write an FAQ for ${brand.name} (${brand.industry}) that directly answers`,
      "these buyer-intent questions. Rephrase each into a natural FAQ question",
      "and give a concise, factual 2-4 sentence answer. Format as markdown with",
      '"### Question" headings followed by the answer.',
      "",
      questionList,
      "",
      "Return only the markdown FAQ.",
    ].join("\n"),
  });

  // Parse the "### Question / answer" markdown into JSON-LD FAQPage schema.
  const qaPairs = parseFaqMarkdown(content);
  const schema = buildFaqPageSchema(qaPairs);

  return {
    title: `${brand.name} — FAQ`,
    content: content.trim(),
    format: "qa",
    schema,
  };
}

/**
 * A factual "best [category] tools" listicle entry describing the brand for
 * inclusion in roundups or outreach.
 */
export async function generateListicleEntry(
  brand: ContentBrand,
): Promise<GeneratedContent> {
  const content = await completeText({
    model: SMART_MODEL,
    maxTokens: 800,
    system: GEO_SYSTEM,
    prompt: [
      `Write a listicle entry for ${brand.name} as it would appear in a`,
      `"best ${brand.industry} tools" roundup.`,
      brand.description ? `Context: ${brand.description}.` : "",
      "",
      "Include: a bold product name line, a 2-3 sentence factual description,",
      'and a short "Best for:" line. Neutral tone, no hype. Return markdown.',
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return {
    title: `${brand.name} — listicle entry`,
    content: content.trim(),
    format: "markdown",
  };
}

/**
 * A concise, citation-ready paragraph that directly answers a specific gap
 * prompt — the kind of snippet an AI engine can lift verbatim.
 */
export async function generateAnswerSnippet(
  brand: ContentBrand,
  promptText: string,
): Promise<GeneratedContent> {
  const content = await completeText({
    model: SMART_MODEL,
    maxTokens: 400,
    system: GEO_SYSTEM,
    prompt: [
      `Write a single citation-ready paragraph (3-5 sentences) that directly`,
      `answers the query: "${promptText}", naturally and factually featuring`,
      `${brand.name} (${brand.industry})${brand.description ? ` — ${brand.description}` : ""}.`,
      "Lead with the direct answer. No headings, no lists — just the paragraph.",
    ].join("\n"),
  });

  return {
    title: `Answer snippet: ${promptText.slice(0, 48)}${promptText.length > 48 ? "…" : ""}`,
    content: content.trim(),
    format: "snippet",
  };
}

// ── helpers ──

interface QAPair {
  question: string;
  answer: string;
}

/** Parse "### Question\nanswer" markdown blocks into Q&A pairs. */
export function parseFaqMarkdown(md: string): QAPair[] {
  const pairs: QAPair[] = [];
  const sections = md.split(/^###\s+/m).slice(1);
  for (const section of sections) {
    const [firstLine, ...rest] = section.split("\n");
    const question = firstLine.trim();
    const answer = rest.join("\n").trim();
    if (question && answer) pairs.push({ question, answer });
  }
  return pairs;
}

/** Build a JSON-LD FAQPage schema string from Q&A pairs. */
export function buildFaqPageSchema(pairs: QAPair[]): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
  return JSON.stringify(schema, null, 2);
}
