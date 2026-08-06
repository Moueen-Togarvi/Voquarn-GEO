import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signState, verifyState } from "@/lib/providers/gsc/oauth";

const originalSecret = process.env.BETTER_AUTH_SECRET;

describe("OAuth state signing", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-for-state-signing";
  });

  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it("round-trips the workspace and site through sign and verify", () => {
    const token = signState({ workspaceId: "ws-1", siteId: "site-1" });
    expect(verifyState(token)).toEqual({
      workspaceId: "ws-1",
      siteId: "site-1",
    });
  });

  it("rejects a token with a tampered payload", () => {
    const token = signState({ workspaceId: "ws-1", siteId: "site-1" });
    const [encoded, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ workspaceId: "attacker-ws", siteId: "site-1" }),
    ).toString("base64url");
    expect(() => verifyState(`${tamperedPayload}.${signature}`)).toThrow(
      /signature mismatch/,
    );
    void encoded;
  });

  it("rejects a token signed with a different secret", () => {
    const token = signState({ workspaceId: "ws-1", siteId: "site-1" });
    process.env.BETTER_AUTH_SECRET = "a-different-secret";
    expect(() => verifyState(token)).toThrow(/signature mismatch/);
  });

  it("rejects a malformed token", () => {
    expect(() => verifyState("not-a-valid-token")).toThrow(/Malformed/);
  });

  it("rejects an expired state", () => {
    vi.useFakeTimers();
    const token = signState({ workspaceId: "ws-1", siteId: "site-1" });
    vi.advanceTimersByTime(11 * 60 * 1000);
    expect(() => verifyState(token)).toThrow(/expired/);
  });
});
