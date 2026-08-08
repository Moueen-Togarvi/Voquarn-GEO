import { eventType } from "inngest";
import { z } from "zod";

/**
 * One event definition per event, matching the table in docs/events.md.
 * Extend this file — never send an event that isn't declared here, and
 * never rename an existing key once a function is deployed; Inngest matches
 * triggers on the literal string.
 *
 * Each export is both the runtime Zod schema (used to validate a payload
 * before sending — see src/lib/inngest/functions/brand-discovery.ts) and an
 * Inngest EventType (used as the typed trigger when declaring the function
 * that handles it).
 */

export const brandDiscoveryRequestedSchema = z.object({
  workspaceId: z.string(),
  operationId: z.string(),
  /** Null on first onboarding (the brand does not exist yet); set on re-analysis. */
  brandId: z.string().nullable(),
  name: z.string(),
  websiteUrl: z.string(),
});

export const brandDiscoveryRequested = eventType("brand/discovery.requested", {
  schema: brandDiscoveryRequestedSchema,
});

export const brandDiscoveryCompletedSchema = z.object({
  workspaceId: z.string(),
  operationId: z.string(),
  brandId: z.string(),
});

export const brandDiscoveryCompleted = eventType("brand/discovery.completed", {
  schema: brandDiscoveryCompletedSchema,
});

export const brandDiscoveryFailedSchema = z.object({
  workspaceId: z.string(),
  operationId: z.string(),
  errorCode: z.string(),
});

export const brandDiscoveryFailed = eventType("brand/discovery.failed", {
  schema: brandDiscoveryFailedSchema,
});

export const promptsGenerationRequestedSchema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  operationId: z.string(),
});

export const promptsGenerationRequested = eventType(
  "prompts/generation.requested",
  { schema: promptsGenerationRequestedSchema },
);

export const competitorExpansionRequestedSchema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  operationId: z.string(),
});

export const competitorExpansionRequested = eventType(
  "competitor/expansion.requested",
  { schema: competitorExpansionRequestedSchema },
);

export const benchmarkBatchRequestedSchema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  batchId: z.string(),
  marketId: z.string(),
  repetitions: z.number().int().positive(),
});

export const benchmarkBatchRequested = eventType("benchmark/batch.requested", {
  schema: benchmarkBatchRequestedSchema,
});

export const benchmarkRunRequestedSchema = z.object({
  workspaceId: z.string(),
  batchId: z.string(),
  promptId: z.string(),
  provider: z.string(),
  model: z.string(),
  repetitionIndex: z.number().int().nonnegative(),
});

export const benchmarkRunRequested = eventType("benchmark/run.requested", {
  schema: benchmarkRunRequestedSchema,
});

export const benchmarkBatchCompletedSchema = z.object({
  workspaceId: z.string(),
  batchId: z.string(),
});

export const benchmarkBatchCompleted = eventType("benchmark/batch.completed", {
  schema: benchmarkBatchCompletedSchema,
});

export const huntSerpRequestedSchema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  marketId: z.string(),
  operationId: z.string(),
});

export const huntSerpRequested = eventType("hunt/serp.requested", {
  schema: huntSerpRequestedSchema,
});

export const huntSerpKeywordRequestedSchema = z.object({
  workspaceId: z.string(),
  keywordId: z.string(),
  marketId: z.string(),
  device: z.enum(["DESKTOP", "MOBILE"]),
});

export const huntSerpKeywordRequested = eventType(
  "hunt/serp.keyword.requested",
  { schema: huntSerpKeywordRequestedSchema },
);

export const huntThreatRecomputeRequestedSchema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  scoreDefinitionId: z.string(),
});

export const huntThreatRecomputeRequested = eventType(
  "hunt/threat.recompute.requested",
  { schema: huntThreatRecomputeRequestedSchema },
);

export const gscImportRequestedSchema = z.object({
  workspaceId: z.string(),
  siteId: z.string(),
  from: z.string(),
  to: z.string(),
});

export const gscImportRequested = eventType("gsc/import.requested", {
  schema: gscImportRequestedSchema,
});

export const crawlRunRequestedSchema = z.object({
  workspaceId: z.string(),
  crawlRunId: z.string(),
  host: z.string(),
});

export const crawlRunRequested = eventType("crawl/run.requested", {
  schema: crawlRunRequestedSchema,
});

export const crawlPageRequestedSchema = z.object({
  workspaceId: z.string(),
  crawlRunId: z.string(),
  url: z.string(),
  host: z.string(),
});

export const crawlPageRequested = eventType("crawl/page.requested", {
  schema: crawlPageRequestedSchema,
});

// docs/events.md lists this event's payload as just `workspaceId, brandId`
// — written before the 202+Operation-polling pattern was pinned down for
// every other `.requested` event. operationId is added here for
// consistency with every sibling trigger (hunt/serp.requested,
// crawl/run.requested, ...); docs/events.md is updated to match.
export const opportunityDetectRequestedSchema = z.object({
  workspaceId: z.string(),
  brandId: z.string(),
  operationId: z.string(),
});

export const opportunityDetectRequested = eventType(
  "opportunity/detect.requested",
  { schema: opportunityDetectRequestedSchema },
);

export const contentBriefRequestedSchema = z.object({
  workspaceId: z.string(),
  contentItemId: z.string(),
  operationId: z.string(),
});

export const contentBriefRequested = eventType("content/brief.requested", {
  schema: contentBriefRequestedSchema,
});

// docs/events.md originally listed this payload as `workspaceId,
// contentItemId, versionId` — written before it was clear which version id
// that would even be. contentDraft (src/lib/inngest/functions/content.ts)
// determines fresh-draft-vs-revision from ContentItem.state itself (BRIEF_READY
// or FAILED means fresh; CHANGES_REQUESTED means revision) and creates its
// own placeholder version, so there is no meaningful versionId to pass in
// before generation starts — docs/events.md is updated to match.
export const contentDraftRequestedSchema = z.object({
  workspaceId: z.string(),
  contentItemId: z.string(),
  operationId: z.string(),
});

export const contentDraftRequested = eventType("content/draft.requested", {
  schema: contentDraftRequestedSchema,
});
