# ADR-0006 — Durable workflows, `Operation`, and idempotency

**Status:** Accepted (Phase 0, implemented in Phase 1a) · **Date:** 2026-08-05

## Context

`src/app/api/inngest/route.ts` serves `functions: []`. Meanwhile
`discoverBrandProfile()` runs synchronously inside `POST /api/brands` for 20–60
seconds, and `src/components/brand-form.tsx` papers over it with a rotating
"researching" ticker. Every later feature is longer-running than this one.

## Decision

**Inngest, no second queue.** No BullMQ.

`Operation(id, workspaceId, brandId?, kind, status, progressCurrent/Total,
idempotencyKey @unique, inngestRunId, actorUserId, error, startedAt, completedAt)`
is the user-facing unit of work. `inngestRunId` links to Inngest's own run
model rather than shadowing it.

Rules:

- Route handlers return `202 Accepted` with an operation ID for long work.
- Every external side effect has an idempotency key.
- Retries must never create duplicate drafts, usage events, or publications.
- Provider rate limits are enforced with global and per-workspace concurrency
  keys, not client-side sleeps.
- Raw input and normalized output are immutable; derived scores regenerate with
  a new algorithm version.
- Cancellation stops future work but never deletes evidence already collected.
- A failed provider produces a partial result with an explicit confidence
  reduction. It must not silently disappear.

Inngest features we commit to using: `EventSchemas.fromZod` (typed events —
miserable to retrofit after 15 functions exist), `step.invoke` for bounded
fan-out (the join comes free, so batch finalization does too), `step.ai.infer`
for LLM calls (keeps long inference off our execution budget), Inngest Realtime
for progress UI from Phase 2 onward, and `@inngest/test`'s `InngestTestEngine`
for step-level tests.

## Consequences

- Phase 1a's first function, `brandDiscovery`, is the reference pattern every
  later long-running feature copies. It is worth over-engineering slightly.
- Progress UI is polling in Phase 1a (`GET /api/operations/[id]`) and switches
  to Realtime in Phase 2. Neither needs TanStack Query.
