import { describe, expect, it } from "vitest";

import { computePromptSetHash } from "@/lib/benchmark/prompt-set-hash";

describe("computePromptSetHash", () => {
  it("is deterministic for the same prompt set", () => {
    const prompts = [
      { id: "p1", text: "What is the best CRM?" },
      { id: "p2", text: "How does Voquarn compare to alternatives?" },
    ];
    expect(computePromptSetHash(prompts)).toBe(computePromptSetHash(prompts));
  });

  it("is independent of input order", () => {
    const a = [
      { id: "p1", text: "Question one" },
      { id: "p2", text: "Question two" },
    ];
    const b = [
      { id: "p2", text: "Question two" },
      { id: "p1", text: "Question one" },
    ];
    expect(computePromptSetHash(a)).toBe(computePromptSetHash(b));
  });

  it("changes when a prompt's text changes", () => {
    const original = [{ id: "p1", text: "Original question" }];
    const edited = [{ id: "p1", text: "Edited question" }];
    expect(computePromptSetHash(original)).not.toBe(
      computePromptSetHash(edited),
    );
  });

  it("changes when the prompt set membership changes", () => {
    const a = [{ id: "p1", text: "Question one" }];
    const b = [
      { id: "p1", text: "Question one" },
      { id: "p2", text: "Question two" },
    ];
    expect(computePromptSetHash(a)).not.toBe(computePromptSetHash(b));
  });

  it("returns a hex sha256 digest", () => {
    const hash = computePromptSetHash([{ id: "p1", text: "x" }]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
