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
