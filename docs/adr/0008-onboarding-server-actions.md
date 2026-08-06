# ADR-0008 — `useActionState` + server actions for the onboarding wizard only

**Status:** Accepted (Phase 1c) · **Date:** 2026-08-06

## Context

The codebase's established data-flow convention (see `CLAUDE.md`) is: server
components call the service layer directly, client components `fetch()` route
handlers, and there are no server actions. That convention holds well for
single-purpose forms with one or two fields.

The onboarding wizard's review and market steps are different: the review step
edits a text profile and toggles an arbitrary number of competitors in one
submission; the market step sets six market fields, a free-form keyword list,
and an optional goal, then activates the project — all as one atomic step in a
flow the user cannot leave partway through. Building this as `fetch()` calls
against route handlers means hand-rolling the request/response/redirect
sequencing that React 19 already provides.

## Decision

Use React 19 `useActionState` with `"use server"` actions **for the
onboarding wizard's review and market steps only**
(`src/app/onboarding/review/[brandId]/actions.ts`,
`src/app/onboarding/market/[brandId]/actions.ts`). Everywhere else in the
product keeps the existing client-fetches-route-handler convention. The same
mutations also stay available as ordinary route handlers
(`PATCH /api/brands/[brandId]/market`, `POST /api/brands/[brandId]/keywords`,
`PATCH /api/competitors/[competitorId]`) for project settings to reuse later,
so the service layer — not the transport — is the single source of truth for
these operations.

## Rationale

Introducing a form library (react-hook-form, etc.) for three forms is not
worth a new dependency. `useActionState` is already in React 19, needs no
library, and its pending/error state maps directly onto the existing
`.form-alert` / `.field-error` CSS classes without inventing new UI patterns.

Redirects inside a server action must happen **outside** any `try/catch` —
`redirect()` works by throwing, and a surrounding `catch` swallows it as a
generic error instead of performing the navigation. Both action files
structure their mutations to return early from `catch` and call `redirect()`
only after the `try` block completes.

## Consequences

- Do not reach for `useActionState` outside this wizard without a similarly
  multi-field, single-flow justification — it is a deliberate, scoped
  exception, not a new default.
- The wizard's server actions and the equivalent API routes call the same
  service functions (`setBrandMarket`, `bulkAddKeywords`,
  `updateCompetitorStatus`, `activateBrand`). If either surface's validation
  drifts from the other, that is a bug in the shared service, not something to
  patch at the transport layer.
