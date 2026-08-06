import { describe, expect, it } from "vitest";

import { buildRepairMessages } from "@/lib/llm/repair";
import { StructuredParseError } from "@/lib/llm/types";

describe("buildRepairMessages", () => {
  it("appends the failed response and a correction instruction", () => {
    const original = [{ role: "user" as const, content: "Write JSON." }];
    const error = new StructuredParseError(
      "Response was not valid JSON: Unexpected token",
      "not json",
    );

    const repaired = buildRepairMessages(original, error);

    expect(repaired).toHaveLength(3);
    expect(repaired[0]).toEqual(original[0]);
    expect(repaired[1]).toEqual({ role: "assistant", content: "not json" });
    expect(repaired[2]?.role).toBe("user");
    expect(repaired[2]?.content).toContain("Response was not valid JSON");
  });

  it("does not mutate the original messages array", () => {
    const original = [{ role: "user" as const, content: "Write JSON." }];
    const error = new StructuredParseError("bad", "raw");

    buildRepairMessages(original, error);

    expect(original).toHaveLength(1);
  });
});
