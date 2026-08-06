# ADR-0004 — `Brand` in the database, "Project" in the UI

**Status:** Accepted (Phase 0) · **Date:** 2026-08-05

## Context

The strategy document proposes three nouns: `Project` (the tracked initiative),
`Site` (a verified domain), and `Brand` (identity and voice used in prompts).
The repository currently has one model, `Brand`, while the UI, the routes
(`/projects/[brandId]`), the cookie (`voquarn_project`), and even the service
layer's error strings ("Project not found.") already say Project.

## Decision

Keep `Brand` as the model name. Keep "Project" in every user-facing string.
`Site` becomes a real model in Phase 1c, because GSC properties, WordPress
connections, and crawl targets attach to a site rather than to a project.
`BrandVoiceProfile` splits out in Phase 6 when the content pipeline needs it.

## Rationale

This is what the code already does, so it costs nothing today.

The counter-argument was recorded and rejected: renaming `Brand`→`Project` now
touches roughly 25 files with zero production rows to migrate, whereas by
Phase 5 it touches ~15 tables carrying `brandId` foreign keys, every Inngest
event payload, and every API client — around a 25× multiplier. The decision was
made with that cost visible.

## Consequences

- New code must not introduce a second vocabulary. `brandId` in code and
  payloads; "Project" in labels, headings, and errors.
- If the rename is ever wanted, the cheapest partial step is free and
  user-invisible: rename the route param `[brandId]` → `[projectId]`. The URL
  segment already reads `/projects/`.
