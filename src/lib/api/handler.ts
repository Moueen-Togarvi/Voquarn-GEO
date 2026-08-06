import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/errors";
import {
  requireWorkspaceContext,
  type WorkspaceContext,
} from "@/lib/auth/context";
import { childLogger } from "@/lib/observability/logger";

type RouteHandlerArgs<TParams> = {
  request: NextRequest;
  ctx: WorkspaceContext;
  params: TParams;
  requestId: string;
};

type RouteHandler<TParams> = (
  args: RouteHandlerArgs<TParams>,
) => Promise<NextResponse>;

/**
 * Wraps a route handler with the concerns every route needs: workspace
 * context, a request id (generated or forwarded), structured start/end
 * logging, and errorResponse on throw. Body and param validation stay inside
 * the handler — this only covers what is common to all of them.
 */
export function route<TParams = Record<string, never>>(
  handler: RouteHandler<TParams>,
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
    const log = childLogger({
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
    });
    const startedAt = Date.now();

    try {
      const ctx = await requireWorkspaceContext();
      const params = context ? await context.params : ({} as TParams);
      const response = await handler({ request, ctx, params, requestId });
      response.headers.set("x-request-id", requestId);
      log.info(
        {
          status: response.status,
          durationMs: Date.now() - startedAt,
          workspaceId: ctx.workspaceId,
        },
        "request completed",
      );
      return response;
    } catch (error) {
      const response = errorResponse(error);
      response.headers.set("x-request-id", requestId);
      log.error(
        {
          status: response.status,
          durationMs: Date.now() - startedAt,
          err: error instanceof Error ? error.message : String(error),
        },
        "request failed",
      );
      return response;
    }
  };
}
