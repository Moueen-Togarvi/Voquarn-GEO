import { describe, expect, it } from "vitest";

import {
  assembleDoc,
  countWords,
  extractPlainText,
  renderToHtml,
} from "@/lib/content/prosemirror";
import type { ProseMirrorDoc } from "@/lib/content/prosemirror";

describe("assembleDoc", () => {
  it("builds a heading + paragraph sequence per section, in order", () => {
    const doc = assembleDoc([
      { heading: "Introduction", level: 2, paragraphs: ["First para."] },
      {
        heading: "Details",
        level: 2,
        paragraphs: ["Second para.", "Third para."],
      },
    ]);

    expect(doc.content).toHaveLength(5);
    expect(doc.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(doc.content[1]).toMatchObject({ type: "paragraph" });
    expect(doc.content[2]).toMatchObject({ type: "heading" });
    expect(doc.content[3]).toMatchObject({ type: "paragraph" });
    expect(doc.content[4]).toMatchObject({ type: "paragraph" });
  });

  it("drops blank paragraphs", () => {
    const doc = assembleDoc([
      { heading: "Section", level: 2, paragraphs: ["Real text.", "  ", ""] },
    ]);
    const paragraphs = doc.content.filter((n) => n.type === "paragraph");
    expect(paragraphs).toHaveLength(1);
  });
});

describe("extractPlainText", () => {
  it("joins block text with newlines", () => {
    const doc = assembleDoc([
      { heading: "Title", level: 2, paragraphs: ["One.", "Two."] },
    ]);
    expect(extractPlainText(doc)).toBe("Title\nOne.\nTwo.");
  });

  it("returns an empty string for an empty doc", () => {
    expect(extractPlainText({ type: "doc", content: [] })).toBe("");
  });
});

describe("countWords", () => {
  it("counts words across the whole document", () => {
    const doc = assembleDoc([
      {
        heading: "Two words",
        level: 2,
        paragraphs: ["Three more words here."],
      },
    ]);
    expect(countWords(doc)).toBe(6);
  });

  it("returns 0 for an empty document", () => {
    expect(countWords({ type: "doc", content: [] })).toBe(0);
  });
});

describe("renderToHtml", () => {
  it("renders headings and paragraphs with the correct tags", () => {
    const doc = assembleDoc([
      { heading: "My Heading", level: 2, paragraphs: ["Body text."] },
    ]);
    const html = renderToHtml(doc);
    expect(html).toContain("<h2>My Heading</h2>");
    expect(html).toContain("<p>Body text.</p>");
  });

  it("escapes HTML in text content — never trusts generated text as safe markup", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: '<script>alert("x")</script>' }],
        },
      ],
    };
    const html = renderToHtml(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders bold and italic marks", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold text", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    expect(renderToHtml(doc)).toContain("<strong>bold text</strong>");
  });

  it("renders bullet lists (list items wrap a paragraph, matching TipTap's schema)", () => {
    const doc: ProseMirrorDoc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item one" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(renderToHtml(doc)).toBe("<ul><li><p>Item one</p></li></ul>");
  });
});
