# ADR-0007 — Observability, rate limiting, and feature flags

**Status:** Accepted (Phase 0, implemented across Phases 1a and 8)
**Date:** 2026-08-05

## Context

There is currently no structured logging, no error reporting, no rate limiting,
and no feature-flag mechanism — while the roadmap mandates flags for "every
provider, publisher, and autonomous action".

## Decisions

**Logging and tracing.** Pino structured logs, emitted from the Inngest logger
middleware and the `src/lib/api/handler.ts` route wrapper so every request and
every step carries workspace, operation, and request IDs. OpenTelemetry through
Next's `src/instrumentation.ts`. Sentry (`@sentry/nextjs` + `onRequestError`)
lands in Phase 8. PostHog, if added, is for product events only — it is not
operational telemetry.

**Rate limiting: Postgres token bucket**, a single `UPDATE … RETURNING` against
a `RateLimitBucket` row. No Redis, no Upstash. One more stateful vendor is not
worth it at beta scale, and cost-class limits must be transactional with the
usage ledger anyway. Revisit if sub-5 ms limiting is ever needed.

**Feature flags: a `FeatureFlag` table plus `src/lib/flags.ts`** with
per-workspace overrides, read in server components. No LaunchDarkly.

**CI databases: a Neon branch per pull request.** The app connects through
`@prisma/adapter-neon`, so a stock Postgres container cannot run the integration
or e2e suites — only the Prisma CLI (and therefore the migration-drift job) can
use one. See `.github/workflows/db-branch.yml`; it skips cleanly when
`NEON_API_KEY` and `NEON_PROJECT_ID` are unset.

## Every operation must be able to answer

Who and which workspace initiated it; which project, prompt, keyword, URL,
content version, and provider were involved; which job and step are running;
what input snapshot and algorithm version produced the output; how long it took,
what it cost, and how many retries occurred; whether the result was complete,
partial, stale, or low confidence; and whether it created an external side
effect that can be reconciled.
