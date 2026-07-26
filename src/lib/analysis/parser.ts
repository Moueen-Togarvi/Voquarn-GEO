import { Sentiment } from "@/lib/types";
import { completeText, FAST_MODEL } from "@/lib/ai";

/** Result of looking for a brand name inside a response. */
export interface MentionResult {
  mentioned: boolean;
  /** Character index of the first mention (earlier = more prominent), or null. */
  position: number | null;
}

/**
 * Build a fuzzy, case-insensitive regex for a name that tolerates variable
 * whitespace and optional punctuation between tokens (e.g. "Note Ion" or
 * "Note-Ion" both match "Notion").
 */
function nameToRegex(name: string): RegExp | null {
  const tokens = name
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);
  if (tokens.length === 0) return null;

  // Between tokens allow whitespace and common separators; each token boundary
  // is soft so "MyBrand" matches inside "MyBrandApp".
  const pattern = tokens.join("[\\s._\\-]*");
  return new RegExp(pattern, "i");
}

/**
 * Detect whether `brandName` appears in `text` (case-insensitive, tolerant of
 * spacing/punctuation). Returns the first-match character index as `position`.
 */
export function detectBrandMention(
  text: string,
  brandName: string,
): MentionResult {
  const regex = nameToRegex(brandName);
  if (!regex || !text) return { mentioned: false, position: null };

  const match = regex.exec(text);
  return match
    ? { mentioned: true, position: match.index }
    : { mentioned: false, position: null };
}

/** Return the subset of `competitors` that are mentioned in `text`. */
export function detectCompetitorMentions(
  text: string,
  competitors: string[],
): string[] {
  if (!text) return [];
  return competitors.filter((c) => detectBrandMention(text, c).mentioned);
}

/**
 * Classify sentiment toward `brandName` in `text` via a quick Claude call.
 * Only call this when the brand is actually mentioned. Defaults to NEUTRAL on
 * any failure so a scan never breaks on sentiment.
 */
export async function extractSentiment(
  text: string,
  brandName: string,
): Promise<Sentiment> {
  try {
    const raw = await completeText({
      model: FAST_MODEL,
      maxTokens: 8,
      system:
        "You classify sentiment toward a specific brand in a passage. " +
        "Reply with exactly one word: POSITIVE, NEUTRAL, or NEGATIVE.",
      prompt: `Brand: ${brandName}\n\nPassage:\n${text}\n\nSentiment:`,
    });

    const upper = raw.toUpperCase();
    if (upper.includes("POSITIVE")) return Sentiment.POSITIVE;
    if (upper.includes("NEGATIVE")) return Sentiment.NEGATIVE;
    return Sentiment.NEUTRAL;
  } catch {
    return Sentiment.NEUTRAL;
  }
}

/**
 * Does any cited source URL belong to the brand's domain? Compares registrable
 * host, tolerating a leading "www." and scheme differences.
 */
export function domainCited(sources: string[], brandDomain: string): boolean {
  const target = normalizeHost(brandDomain);
  if (!target) return false;
  return sources.some((src) => {
    const host = extractHost(src);
    return host === target || host.endsWith(`.${target}`);
  });
}

function normalizeHost(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
}

function extractHost(url: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalizeHost(url);
  }
}
