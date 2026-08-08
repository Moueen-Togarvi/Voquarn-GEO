import { describe, expect, it } from "vitest";

import { isTransientDbError, normalizeDbError } from "@/lib/db/resilience";

describe("isTransientDbError", () => {
  it("treats a raw ErrorEvent-shaped object as transient", () => {
    expect(isTransientDbError({ type: "error", timeStamp: 123 })).toBe(true);
  });

  it("treats a real Error with a network errno code as transient", () => {
    const error = new Error("socket hang up") as NodeJS.ErrnoException;
    error.code = "ECONNRESET";
    expect(isTransientDbError(error)).toBe(true);
  });

  it("treats a real Error mentioning a dropped websocket as transient", () => {
    expect(isTransientDbError(new Error("WebSocket connection closed"))).toBe(
      true,
    );
  });

  it("treats a Prisma P2028 (transaction already closed) error as transient", () => {
    const error = new Error(
      "Transaction API error: Transaction already closed: A rollback cannot be executed on a committed transaction.",
    ) as Error & { code: string };
    error.code = "P2028";
    expect(isTransientDbError(error)).toBe(true);
  });

  it("does not treat an ordinary application Error as transient", () => {
    expect(isTransientDbError(new Error("Record not found"))).toBe(false);
  });

  it("does not treat an unrelated non-Error value as transient", () => {
    expect(isTransientDbError("some string")).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(42)).toBe(false);
  });
});

describe("normalizeDbError", () => {
  it("passes a real Error through unchanged", () => {
    const error = new Error("boom");
    expect(normalizeDbError(error)).toBe(error);
  });

  it("converts an ErrorEvent-shaped object into a real Error with a useful message", () => {
    const result = normalizeDbError({ type: "error" });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain("error");
    expect(result.message.toLowerCase()).toContain("connection");
  });

  it("converts an arbitrary thrown value into a real Error", () => {
    const result = normalizeDbError("plain string throw");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain("plain string throw");
  });
});
