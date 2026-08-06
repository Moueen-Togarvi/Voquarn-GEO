import type {
  ClaimKind,
  ClaimStatus,
  RiskCategory,
} from "@/generated/prisma/enums";

/**
 * Pure, unit-tested predicates — these are what actually gate approval, not
 * QualityScore (advisory only, see the model comment in schema.prisma).
 * Acceptance test from the implementation plan: "[SOURCE NEEDED],
 * [EXPERT NEEDED], or unresolved placeholders block approval" and "every
 * factual claim has a source, is explicitly marked opinion/first-party
 * input, or is removed."
 */

export type BlockerKind =
  "PLACEHOLDER" | "UNSOURCED_CLAIM" | "RISKY_CLAIM" | "INVENTED_QUOTE";

export type Blocker = {
  kind: BlockerKind;
  message: string;
  claimId?: string;
};

// Matches bracketed all-caps markers like [SOURCE NEEDED], [EXPERT NEEDED],
// or any other placeholder a draft leaves for a human — e.g. [ADD PRICING].
// Requires at least 3 letters so it doesn't false-positive on stray
// single-word brackets like a citation marker "[1]".
const PLACEHOLDER_PATTERN = /\[([A-Z][A-Z ]{2,39})\]/g;

export function detectPlaceholders(text: string): Blocker[] {
  const seen = new Set<string>();
  const blockers: Blocker[] = [];

  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const label = match[0];
    if (seen.has(label)) continue;
    seen.add(label);
    blockers.push({
      kind: "PLACEHOLDER",
      message: `Unresolved placeholder: ${label}`,
    });
  }

  return blockers;
}

export type ClaimWithEvidence = {
  id: string;
  text: string;
  kind: ClaimKind;
  status: ClaimStatus;
  riskCategory: RiskCategory | null;
  hasEvidence: boolean;
};

function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// A run of 8+ non-quote characters between quote marks — a crude but
// deliberately narrow heuristic for "this reads like a direct quotation,"
// which needs a source regardless of the claim's kind (an invented quote
// attributed to no one is a real defect even if the surrounding sentence is
// opinion).
const QUOTE_PATTERN = /["“][^"”]{8,}["”]/;

export function detectClaimBlockers(claims: ClaimWithEvidence[]): Blocker[] {
  const blockers: Blocker[] = [];

  for (const claim of claims) {
    if (claim.riskCategory) {
      blockers.push({
        kind: "RISKY_CLAIM",
        message: `${claim.riskCategory} claim needs human review: "${truncate(claim.text)}"`,
        claimId: claim.id,
      });
    }

    if (claim.kind === "FACTUAL" && !claim.hasEvidence) {
      blockers.push({
        kind: "UNSOURCED_CLAIM",
        message: `Unsourced factual claim: "${truncate(claim.text)}"`,
        claimId: claim.id,
      });
    }

    if (QUOTE_PATTERN.test(claim.text) && !claim.hasEvidence) {
      blockers.push({
        kind: "INVENTED_QUOTE",
        message: `Quoted text has no source: "${truncate(claim.text)}"`,
        claimId: claim.id,
      });
    }
  }

  return blockers;
}

export function computeBlockers(input: {
  text: string;
  claims: ClaimWithEvidence[];
}): Blocker[] {
  return [
    ...detectPlaceholders(input.text),
    ...detectClaimBlockers(input.claims),
  ];
}
