/** Generates the content of an llms.txt file per the informal spec: an H1 name, a one-line blockquote summary, and optional H2 sections of linked pages. */
export type LlmsTxtInput = {
  brandName: string;
  description: string;
  keyPages?: { title: string; url: string }[];
};

export function generateLlmsTxt(input: LlmsTxtInput): string {
  const lines: string[] = [
    `# ${input.brandName}`,
    "",
    `> ${input.description}`,
  ];

  if (input.keyPages && input.keyPages.length > 0) {
    lines.push("", "## Pages", "");
    for (const page of input.keyPages) {
      lines.push(`- [${page.title}](${page.url})`);
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
