# ADR-0001 — Product name and the identifiers bound to it

**Status:** Accepted (Phase 0) · **Date:** 2026-08-05

## Context

Three names are in circulation: "RankHunter AI" (the PRD), "Voquarn GEO" (the
repository and workspace), and "Vouarn" (a PRD filename typo). Most of that is
cosmetic, but three identifiers are expensive to change later:

1. `Inngest({ id: "voquarn-geo" })` in `src/lib/inngest/client.ts`. Changing the
   app id after functions are deployed orphans event history and in-flight runs.
2. `package.json` `name`.
3. OAuth redirect URIs, once Search Console and WordPress connections exist.

## Decision

**Voquarn GEO** is the canonical product name. The Inngest app id stays
`voquarn-geo` and is now frozen — it must not change without a deliberate
migration of event history.

"RankHunter AI" is treated as an early working title with no code binding.

## Consequences

- Renaming the product later is a find-and-replace on display strings, plus a
  deliberate Inngest app migration.
- OAuth callbacks registered from Phase 3 onward use the Voquarn domain.
