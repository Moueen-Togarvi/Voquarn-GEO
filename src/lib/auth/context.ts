import { headers } from "next/headers";
import { cache } from "react";

import { AppError } from "@/lib/api/errors";
import { auth } from "@/lib/auth/server";
import { isAuthEnabled } from "@/lib/auth/flag";
import type { WorkspaceContext } from "@/lib/auth/roles";
import { db } from "@/lib/db";

export {
  assertRole,
  type WorkspaceContext,
  type WorkspaceRole,
} from "@/lib/auth/roles";

// Same default workspace Phase 1a used before Better Auth existed — kept
// here only for the isAuthEnabled() === false path. See src/lib/auth/flag.ts.
const DEFAULT_WORKSPACE_SLUG = "default";

/**
 * The single seam between the app and whichever auth vendor is in use.
 *
 * This throws rather than redirecting, so it behaves correctly from both
 * call sites that use it: route handlers (src/lib/api/handler.ts's route()
 * wraps everything in try/catch → errorResponse, where a thrown AppError
 * becomes a 401/403 JSON response) and Server Components (where a thrown
 * error surfaces via the nearest error.tsx boundary). Redirecting an
 * unauthenticated *page* visit to /sign-in is proxy.ts's job — an optimistic,
 * cookie-only check per the Next.js auth guide. This function is the
 * mandatory backstop for whatever proxy's matcher doesn't cover; it must
 * never be the only thing standing between a route and someone else's data.
 *
 * Wrapped in React's cache() so a single request (e.g. a layout and its page
 * both needing the context) resolves it once instead of once per caller.
 */
export const requireWorkspaceContext = cache(
  async (): Promise<WorkspaceContext> => {
    if (!isAuthEnabled()) {
      const workspace = await db.workspace.upsert({
        where: { slug: DEFAULT_WORKSPACE_SLUG },
        update: {},
        create: { slug: DEFAULT_WORKSPACE_SLUG, name: "Voquarn Workspace" },
      });
      return { workspaceId: workspace.id, userId: null, role: "OWNER" };
    }

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.session || !session.user) {
      throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    const activeWorkspaceId = session.session.activeOrganizationId;
    if (!activeWorkspaceId) {
      throw new AppError(
        409,
        "NO_ACTIVE_WORKSPACE",
        "No active workspace is selected.",
      );
    }

    // Re-checked against the database rather than trusted from the session
    // payload alone: a member can be removed from a workspace without their
    // existing session being invalidated first.
    const membership = await db.member.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: activeWorkspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You are not a member of this workspace.",
      );
    }

    return {
      workspaceId: activeWorkspaceId,
      userId: session.user.id,
      role: membership.role,
    };
  },
);
