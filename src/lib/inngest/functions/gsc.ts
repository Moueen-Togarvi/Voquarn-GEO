import { cron, NonRetriableError } from "inngest";

import type { WorkspaceContext } from "@/lib/auth/context";
import { db } from "@/lib/db";
import { scopedDb } from "@/lib/db/scoped";
import { inngest } from "@/lib/inngest/client";
import { gscImportRequested } from "@/lib/inngest/events";
import {
  markConnectionError,
  markConnectionValidated,
} from "@/lib/integrations/service";
import { childLogger } from "@/lib/observability/logger";
import { querySearchAnalytics } from "@/lib/providers/gsc/client";
import {
  mapSearchAnalyticsRows,
  trailingImportWindow,
} from "@/lib/providers/gsc/import";
import { getFreshAccessToken } from "@/lib/providers/gsc/tokens";

/**
 * Queues one gsc/import.requested event per ACTIVE Google Search Console
 * connection. Runs daily; each individual import (gscImport, below)
 * re-pulls a trailing window rather than tracking a "since last import"
 * cursor, which is what makes it self-correcting for GSC's own reporting
 * delay — see src/lib/providers/gsc/import.ts.
 */
export const gscDailyImport = inngest.createFunction(
  { id: "gsc-daily-import", triggers: [cron("0 6 * * *")] },
  async ({ step }) => {
    const connections = await step.run("load-active-connections", () =>
      db.integrationConnection.findMany({
        where: { provider: "GOOGLE_SEARCH_CONSOLE", status: "ACTIVE" },
        select: { id: true, workspaceId: true, siteId: true },
      }),
    );

    const { startDate, endDate } = trailingImportWindow();

    for (const connection of connections) {
      await step.sendEvent(`request-import-${connection.id}`, {
        ...gscImportRequested.create({
          workspaceId: connection.workspaceId,
          siteId: connection.siteId,
          from: startDate,
          to: endDate,
        }),
      });
    }

    return { queuedConnections: connections.length, startDate, endDate };
  },
);

export const gscImport = inngest.createFunction(
  {
    id: "gsc-import",
    triggers: [{ event: gscImportRequested }],
    concurrency: { key: "event.data.workspaceId", limit: 2 },
    retries: 2,
  },
  async ({ event, step }) => {
    const { workspaceId, siteId, from, to } = event.data;
    const ctx: WorkspaceContext = { workspaceId, userId: null, role: "OWNER" };
    const log = childLogger({ siteId, workspaceId, fn: "gscImport" });

    const context = await step.run("load-context", async () => {
      const site = await scopedDb(ctx).site.findFirstOrThrow({
        where: { id: siteId },
      });
      if (!site.gscSiteUrl) {
        throw new NonRetriableError(
          "This site has no gscSiteUrl configured — connect Search Console again to set it.",
        );
      }

      const connection = await scopedDb(ctx).integrationConnection.findFirst({
        where: { siteId, provider: "GOOGLE_SEARCH_CONSOLE", status: "ACTIVE" },
        select: { id: true },
      });
      if (!connection) {
        throw new NonRetriableError(
          "No active Google Search Console connection for this site.",
        );
      }

      return { gscSiteUrl: site.gscSiteUrl, connectionId: connection.id };
    });

    const rows = await step.run("query-search-analytics", async () => {
      try {
        const accessToken = await getFreshAccessToken(
          ctx,
          context.connectionId,
        );
        const analyticsRows = await querySearchAnalytics({
          accessToken,
          siteUrl: context.gscSiteUrl,
          startDate: from,
          endDate: to,
        });
        return mapSearchAnalyticsRows(analyticsRows);
      } catch (error) {
        await markConnectionError(ctx, context.connectionId);
        throw error;
      }
    });

    // Sequential per-row upsert — fine at beta volume (a few thousand rows
    // per site per week). A real bulk path (createMany + a separate
    // updateMany pass, or raw SQL upsert) is a straightforward follow-up
    // once row counts make this the bottleneck; nothing about the shape
    // above needs to change for that.
    await step.run("persist-rows", async () => {
      for (const row of rows) {
        await scopedDb(ctx).searchPerformanceRow.upsert({
          where: {
            siteId_date_query_page: {
              siteId,
              date: new Date(row.date),
              query: row.query,
              page: row.page,
            },
          },
          update: {
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          },
          create: {
            workspaceId,
            siteId,
            date: new Date(row.date),
            query: row.query,
            page: row.page,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          },
        });
      }
    });

    await step.run("mark-validated", () =>
      markConnectionValidated(ctx, context.connectionId),
    );

    log.info({ rowCount: rows.length }, "GSC import completed");

    return { siteId, rowCount: rows.length };
  },
);
