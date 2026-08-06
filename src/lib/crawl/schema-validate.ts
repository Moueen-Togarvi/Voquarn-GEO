/**
 * A minimal, dependency-free schema.org structural check — not a full
 * validator (no schema.org vocabulary/type library is installed, and this
 * session has repeatedly avoided adding new dependencies for a check this
 * narrow). It confirms the two things that make a JSON-LD block usable at
 * all (`@context` and `@type` present) and records anything missing as a
 * mismatch, which is enough to answer "does this page's structured data
 * even parse into something identifiable" for the autopsy.
 */
export type SchemaValidationResult = {
  type: string;
  valid: boolean;
  mismatches: string[];
};

export function validateJsonLdBlock(
  block: Record<string, unknown>,
): SchemaValidationResult {
  const mismatches: string[] = [];

  const rawType = block["@type"];
  const type =
    typeof rawType === "string"
      ? rawType
      : Array.isArray(rawType) && typeof rawType[0] === "string"
        ? rawType[0]
        : null;

  if (!block["@context"]) mismatches.push("Missing @context.");
  if (!type) mismatches.push("Missing @type.");

  return {
    type: type ?? "Unknown",
    valid: mismatches.length === 0,
    mismatches,
  };
}

export function validateJsonLdBlocks(
  blocks: Record<string, unknown>[],
): SchemaValidationResult[] {
  return blocks.map(validateJsonLdBlock);
}
