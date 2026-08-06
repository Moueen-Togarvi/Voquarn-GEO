import { createHash } from "node:crypto";

/**
 * Deterministic sha256 over every included prompt's (id, text) — order
 * independent (sorted by id first) so recreating an identical prompt set
 * always yields the same hash. A prompt edit changes this on the next batch,
 * which is the point: it marks the two batches as non-comparable. See
 * docs/benchmark-protocol.md.
 *
 * Kept dependency-free (no scopedDb import) so it can be unit tested without
 * a database — see src/lib/db/inject-scope.ts and src/lib/auth/roles.ts for
 * the same pattern.
 */
export function computePromptSetHash(
  prompts: { id: string; text: string }[],
): string {
  const sorted = [...prompts].sort((a, b) => a.id.localeCompare(b.id));
  const hash = createHash("sha256");
  for (const prompt of sorted) {
    hash.update(prompt.id);
    hash.update(" ");
    hash.update(prompt.text);
    hash.update("");
  }
  return hash.digest("hex");
}
