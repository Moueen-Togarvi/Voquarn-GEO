import type { ProseMirrorDoc } from "@/lib/content/prosemirror";

/**
 * Advisory only — never wired into computeBlockers() (src/lib/content/blockers.ts).
 * A missing meta description is a real defect worth surfacing to a
 * reviewer, but it is not the kind of thing the plan's acceptance tests
 * treat as approval-blocking. Deliberately narrow: title/description
 * length and heading hierarchy only — link validity, image alt text, and
 * canonical-intention checks need data (rendered links, images) this
 * version's ContentVersion doesn't carry yet, and are left for a fast
 * follow rather than expanding this phase's already-large scope further.
 */

export type SeoIssueKind =
  | "MISSING_TITLE"
  | "TITLE_TOO_LONG"
  | "MISSING_DESCRIPTION"
  | "DESCRIPTION_LENGTH"
  | "NO_HEADINGS"
  | "SKIPPED_HEADING_LEVEL";

export type SeoIssue = { kind: SeoIssueKind; message: string };

const TITLE_MAX = 60;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 160;

export function checkTitle(title: string | null): SeoIssue[] {
  if (!title || title.trim().length === 0) {
    return [{ kind: "MISSING_TITLE", message: "No title set." }];
  }
  if (title.length > TITLE_MAX) {
    return [
      {
        kind: "TITLE_TOO_LONG",
        message: `Title is ${title.length} characters; keep it under ${TITLE_MAX}.`,
      },
    ];
  }
  return [];
}

export function checkDescription(description: string | null): SeoIssue[] {
  if (!description || description.trim().length === 0) {
    return [
      { kind: "MISSING_DESCRIPTION", message: "No meta description set." },
    ];
  }
  if (
    description.length < DESCRIPTION_MIN ||
    description.length > DESCRIPTION_MAX
  ) {
    return [
      {
        kind: "DESCRIPTION_LENGTH",
        message: `Meta description is ${description.length} characters; aim for ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}.`,
      },
    ];
  }
  return [];
}

export function checkHeadingHierarchy(doc: ProseMirrorDoc): SeoIssue[] {
  const levels = doc.content
    .filter((node) => node.type === "heading")
    .map((node) => Number(node.attrs?.level) || 2);

  if (levels.length === 0) {
    return [
      { kind: "NO_HEADINGS", message: "No headings found in the draft." },
    ];
  }

  const issues: SeoIssue[] = [];
  let previous = levels[0]!;
  for (const level of levels.slice(1)) {
    if (level > previous + 1) {
      issues.push({
        kind: "SKIPPED_HEADING_LEVEL",
        message: `Heading level jumps from H${previous} to H${level} without an H${previous + 1} in between.`,
      });
    }
    previous = level;
  }
  return issues;
}

export function computeSeoIssues(input: {
  title: string | null;
  description: string | null;
  doc: ProseMirrorDoc;
}): SeoIssue[] {
  return [
    ...checkTitle(input.title),
    ...checkDescription(input.description),
    ...checkHeadingHierarchy(input.doc),
  ];
}
