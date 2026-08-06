import { AppError } from "@/lib/api/errors";

/**
 * Pure — no server.ts/db import, unlike context.ts, so it is safe to unit
 * test without a database. See tests/unit/authz.test.ts.
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type WorkspaceContext = {
  workspaceId: string;
  /**
   * Null for system-initiated work with no signed-in actor — an Inngest
   * function triggered by an event has nobody at the keyboard. Always a real
   * id when this comes from requireWorkspaceContext(), which throws before
   * returning otherwise.
   */
  userId: string | null;
  role: WorkspaceRole;
};

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

/** Throws 403 FORBIDDEN if ctx.role is below the minimum required role. */
export function assertRole(ctx: WorkspaceContext, minimum: WorkspaceRole) {
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minimum]) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have permission to perform this action.",
    );
  }
}
