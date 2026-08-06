/**
 * Bump whenever analyzeAnswer()'s behavior changes in a way that would shift
 * results for previously-analyzed answers. Stored on both RunAnalysis and
 * AnalysisBatch so a reader can tell whether two batches used the same
 * extractor. See docs/benchmark-protocol.md.
 */
export const EXTRACTION_VERSION = "v1";

export type AliasEntity = {
  id: string;
  aliases: string[];
};

export type AnswerAnalysis = {
  brandMentioned: boolean;
  mentionCount: number;
  firstMentionCharIndex: number | null;
  /** 1-based rank of the brand's first mention among every tracked entity actually mentioned. Null if the brand was not mentioned. */
  position: number | null;
  /** competitorId -> mention count, over every competitor passed in, including zeros. */
  competitorMentions: Record<string, number>;
  refused: boolean;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const URL_PATTERN = /https?:\/\/\S+/gi;

/**
 * Blanks out URLs (same length, so character offsets into the rest of the
 * text still line up) before alias matching runs. A citation like
 * "[Voquarn](https://voquarn.com)" must count as one mention, not two — the
 * URL restates the same mention the display text already carries, it is not
 * independent evidence of a second one.
 */
function blankUrls(text: string): string {
  return text.replace(URL_PATTERN, (match) => " ".repeat(match.length));
}

function findMentions(
  text: string,
  aliases: string[],
): { count: number; firstIndex: number | null } {
  const searchable = blankUrls(text);
  let count = 0;
  let firstIndex: number | null = null;

  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed) continue;

    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "gi");
    for (const match of searchable.matchAll(pattern)) {
      count += 1;
      const index = match.index;
      if (
        typeof index === "number" &&
        (firstIndex === null || index < firstIndex)
      ) {
        firstIndex = index;
      }
    }
  }

  return { count, firstIndex };
}

/**
 * Phrase-based, not sentiment-based: this only catches an explicit
 * declination to answer, never a merely hedgy or uncertain answer. Deciding
 * "did this refuse" is what lets visibility's denominator exclude refusals
 * without also silently excluding "I'm not sure, but X seems relevant"
 * answers, which are real (if low-confidence) completions.
 */
const REFUSAL_PATTERNS: RegExp[] = [
  /\bi can(?:no|')t (?:help|assist|provide|answer|comply)\b/i,
  /\bi(?:'m| am) (?:not able|unable) to\b/i,
  /\bi won'?t be able to\b/i,
  /\bi do not have (?:the ability|access) to\b/i,
  /\bi must decline\b/i,
  /\bi'm sorry,? but i can'?t\b/i,
];

export function detectRefusal(answerText: string): boolean {
  const trimmed = answerText.trim();
  if (!trimmed) return true;
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Pure, network-free, and deliberately dumb: normalized word-boundary alias
 * matching only. No LLM call performs mention detection, position, or
 * refusal classification — see docs/benchmark-protocol.md for why. Reports
 * what is literally in the text; callers decide how a refused answer's
 * fields should be weighted (src/lib/benchmark/aggregate.ts excludes refused
 * runs from visibility/shareOfVoice/position/sentiment).
 */
export function analyzeAnswer(
  answerText: string,
  brandAliases: string[],
  competitors: AliasEntity[],
): AnswerAnalysis {
  const refused = detectRefusal(answerText);
  const brand = findMentions(answerText, brandAliases);

  const competitorMentions: Record<string, number> = {};
  const firstMentions: Array<{ id: string; index: number }> = [];

  if (brand.firstIndex !== null) {
    firstMentions.push({ id: "__brand__", index: brand.firstIndex });
  }

  for (const competitor of competitors) {
    const result = findMentions(answerText, competitor.aliases);
    competitorMentions[competitor.id] = result.count;
    if (result.firstIndex !== null) {
      firstMentions.push({ id: competitor.id, index: result.firstIndex });
    }
  }

  firstMentions.sort((a, b) => a.index - b.index);
  const position =
    brand.firstIndex !== null
      ? firstMentions.findIndex((entry) => entry.id === "__brand__") + 1
      : null;

  return {
    brandMentioned: brand.count > 0,
    mentionCount: brand.count,
    firstMentionCharIndex: brand.firstIndex,
    position,
    competitorMentions,
    refused,
  };
}
