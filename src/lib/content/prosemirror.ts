/**
 * A minimal, pure ProseMirror JSON model — just the node types TipTap's
 * StarterKit produces and this codebase's own generation ever writes
 * (heading, paragraph, bulletList/orderedList/listItem, text with
 * bold/italic marks). Not a general ProseMirror schema implementation —
 * the editor (@tiptap/react, StarterKit) is the actual source of truth for
 * what's structurally valid; this only needs to read and write the subset
 * server-side generation ever touches.
 */
export type ProseMirrorMark = { type: string };

export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: ProseMirrorMark[];
};

export type ProseMirrorDoc = { type: "doc"; content: ProseMirrorNode[] };

export function emptyDoc(): ProseMirrorDoc {
  return { type: "doc", content: [] };
}

/** Depth-first text extraction, joining block-level nodes with newlines so sentence/paragraph boundaries survive for claim extraction and word counting. */
export function extractPlainText(doc: ProseMirrorDoc): string {
  const lines: string[] = [];

  function walk(node: ProseMirrorNode): string {
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(walk).join("");
  }

  for (const node of doc.content) {
    lines.push(walk(node));
  }

  return lines.filter((line) => line.length > 0).join("\n");
}

export function countWords(doc: ProseMirrorDoc): number {
  const text = extractPlainText(doc).trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapMarks(text: string, marks: ProseMirrorMark[] | undefined): string {
  let html = escapeHtml(text);
  for (const mark of marks ?? []) {
    if (mark.type === "bold") html = `<strong>${html}</strong>`;
    if (mark.type === "italic") html = `<em>${html}</em>`;
  }
  return html;
}

function renderInline(node: ProseMirrorNode): string {
  if (node.type === "text") return wrapMarks(node.text ?? "", node.marks);
  return (node.content ?? []).map(renderInline).join("");
}

function renderBlock(node: ProseMirrorNode): string {
  const inner = (node.content ?? []).map(renderInline).join("");

  switch (node.type) {
    case "paragraph":
      return `<p>${inner}</p>`;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
      return `<h${level}>${inner}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${(node.content ?? []).map(renderBlock).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map(renderBlock).join("")}</ol>`;
    case "listItem":
      return `<li>${(node.content ?? []).map(renderBlock).join("")}</li>`;
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(renderBlock).join("")}</blockquote>`;
    default:
      return `<p>${inner}</p>`;
  }
}

/** The only writer of ContentVersion.html — a minimal, deliberately narrow serializer for the node types listed above, not a general ProseMirror-to-HTML library. Always escapes text content. */
export function renderToHtml(doc: ProseMirrorDoc): string {
  return doc.content.map(renderBlock).join("\n");
}

/** Splits generated section prose into paragraph nodes on blank lines — the shape a section-generation LLM call is asked to return (one string of prose per section, not pre-structured JSON). */
export function paragraphsToNodes(paragraphs: string[]): ProseMirrorNode[] {
  return paragraphs
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    }));
}

export type DraftSection = {
  heading: string;
  level: 2 | 3;
  paragraphs: string[];
};

/** Assembles independently-generated sections (see the section-level idempotency comment on contentDraft in src/lib/inngest/functions/content.ts) into one ProseMirror document, in the given order. */
export function assembleDoc(sections: DraftSection[]): ProseMirrorDoc {
  const content: ProseMirrorNode[] = [];
  for (const section of sections) {
    content.push({
      type: "heading",
      attrs: { level: section.level },
      content: [{ type: "text", text: section.heading }],
    });
    content.push(...paragraphsToNodes(section.paragraphs));
  }
  return { type: "doc", content };
}
