import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";

describe("API error envelope", () => {
  it("returns stable application error shapes", async () => {
    const response = errorResponse(
      new AppError(404, "BRAND_NOT_FOUND", "Project not found."),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "BRAND_NOT_FOUND", message: "Project not found." },
    });
  });

  it("returns flattened field errors for invalid requests", async () => {
    const schema = z.object({ name: z.string().min(2, "Name is too short") });
    const parsed = schema.safeParse({ name: "V" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const response = errorResponse(parsed.error);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.fieldErrors.name).toContain("Name is too short");
  });

  it("treats malformed JSON as a client error", async () => {
    const response = errorResponse(new SyntaxError("Unexpected token"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_JSON",
        message: "The request body must contain valid JSON.",
      },
    });
  });
});
