/**
 * Canonical form used for the (marketId, normalized) uniqueness constraint —
 * "Project Management Software" and "project   management software" must
 * collide, or the same keyword gets tracked twice under the same market.
 * Pure and network-free so it can be unit tested directly.
 */
export function normalizeKeyword(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}
