import { describe, expect, it } from "vitest";

import {
  assertRole,
  type WorkspaceContext,
  type WorkspaceRole,
} from "@/lib/auth/roles";

const ROLES: WorkspaceRole[] = ["VIEWER", "EDITOR", "ADMIN", "OWNER"];
const RANK: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

function ctxWithRole(role: WorkspaceRole): WorkspaceContext {
  return { workspaceId: "ws_test", userId: "user_test", role };
}

describe("assertRole", () => {
  // Every (actual role, minimum required) pair — the full matrix, not just
  // the happy path and one failure case.
  for (const actual of ROLES) {
    for (const minimum of ROLES) {
      const shouldPass = RANK[actual] >= RANK[minimum];

      it(`${actual} ${shouldPass ? "passes" : "is rejected by"} a minimum of ${minimum}`, () => {
        if (shouldPass) {
          expect(() => assertRole(ctxWithRole(actual), minimum)).not.toThrow();
        } else {
          expect(() => assertRole(ctxWithRole(actual), minimum)).toThrow();
        }
      });
    }
  }

  it("throws a 403 FORBIDDEN AppError, not a generic error", async () => {
    const { AppError } = await import("@/lib/api/errors");
    try {
      assertRole(ctxWithRole("VIEWER"), "OWNER");
      expect.unreachable("assertRole should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as InstanceType<typeof AppError>).status).toBe(403);
      expect((error as InstanceType<typeof AppError>).code).toBe("FORBIDDEN");
    }
  });
});
