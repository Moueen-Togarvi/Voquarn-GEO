import { describe, expect, it } from "vitest";

import {
  checkDescription,
  checkHeadingHierarchy,
  checkTitle,
  computeSeoIssues,
} from "@/lib/content/seo-check";
import { assembleDoc } from "@/lib/content/prosemirror";

describe("checkTitle", () => {
  it("flags a missing title", () => {
    expect(checkTitle(null).map((i) => i.kind)).toEqual(["MISSING_TITLE"]);
  });

  it("flags a title over 60 characters", () => {
    const long = "A".repeat(61);
    expect(checkTitle(long).map((i) => i.kind)).toEqual(["TITLE_TOO_LONG"]);
  });

  it("accepts a well-sized title", () => {
    expect(checkTitle("A reasonable page title")).toEqual([]);
  });
});

describe("checkDescription", () => {
  it("flags a missing description", () => {
    expect(checkDescription(null).map((i) => i.kind)).toEqual([
      "MISSING_DESCRIPTION",
    ]);
  });

  it("flags a description that is too short", () => {
    expect(checkDescription("Too short.").map((i) => i.kind)).toEqual([
      "DESCRIPTION_LENGTH",
    ]);
  });

  it("accepts a well-sized description", () => {
    const good = "A".repeat(120);
    expect(checkDescription(good)).toEqual([]);
  });
});

describe("checkHeadingHierarchy", () => {
  it("flags a document with no headings", () => {
    expect(
      checkHeadingHierarchy({ type: "doc", content: [] }).map((i) => i.kind),
    ).toEqual(["NO_HEADINGS"]);
  });

  it("flags a skipped heading level", () => {
    const doc = assembleDoc([
      { heading: "Top", level: 2, paragraphs: ["text"] },
    ]);
    doc.content.push({
      type: "heading",
      attrs: { level: 4 },
      content: [{ type: "text", text: "Skipped" }],
    });
    const issues = checkHeadingHierarchy(doc);
    expect(issues.map((i) => i.kind)).toEqual(["SKIPPED_HEADING_LEVEL"]);
  });

  it("does not flag consecutive heading levels", () => {
    const doc = assembleDoc([
      { heading: "Top", level: 2, paragraphs: ["text"] },
      { heading: "Sub", level: 3, paragraphs: ["text"] },
    ]);
    expect(checkHeadingHierarchy(doc)).toEqual([]);
  });
});

describe("computeSeoIssues", () => {
  it("combines all three checks", () => {
    const issues = computeSeoIssues({
      title: null,
      description: null,
      doc: { type: "doc", content: [] },
    });
    expect(issues.map((i) => i.kind)).toEqual([
      "MISSING_TITLE",
      "MISSING_DESCRIPTION",
      "NO_HEADINGS",
    ]);
  });
});
