# ADR-0002 — Better Auth for identity and tenancy

**Status:** Accepted (Phase 0, implemented in Phase 1b) · **Date:** 2026-08-05

## Context

The app has no authentication. `ensureDefaultWorkspace()` upserts a single
hardcoded `slug: "default"` workspace at the top of every service function. The
README correctly warns the deployment must not be public.

Candidates considered: Clerk Organizations (the PRD's suggestion; `.gitignore`
already contains `/.clerk/`), Better Auth with the organization plugin,
WorkOS AuthKit, and Auth.js/NextAuth.

## Decision

**Better Auth with the `organization` plugin.**

Map the plugin's `organization` model onto the **existing `Workspace` table**
via Better Auth's schema field mapping. `Workspace` already has `id`, `name`,
`slug @unique`, and `createdAt`; only `logo` and `metadata` need adding. This
avoids rewriting the `Brand.workspaceId` foreign key entirely.

Roles: `OWNER | ADMIN | EDITOR | VIEWER` through Better Auth access control.

## Rationale

- Runs on the Neon/Prisma database already paid for. No per-MAU cost, which
  matters for a product whose margins are already squeezed by provider spend.
- Identity data stays in our own database, so authorization tests can assert
  against it directly rather than stubbing a vendor.
- Auth.js was ruled out: no first-class organization or role model, so the whole
  membership layer would be hand-built anyway.
- Clerk is faster to ship and would be the right call for a pure speed
  optimization; the per-MAU cost and external identity store lost on balance.

## Consequences

- We own security patching and session-handling correctness.
- The vendor seam is deliberately one function: `requireWorkspaceContext()` in
  `src/lib/auth/context.ts`. Phase 1a ships it returning the default workspace
  with no vendor at all; Phase 1b swaps only its body. Switching auth vendors
  later should touch that file and the sign-in pages, nothing else.
