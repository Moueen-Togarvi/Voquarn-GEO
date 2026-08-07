# ADR-0003 — Provider abstraction and where the AI SDK sits

**Status:** Accepted (Phase 0, implemented in Phase 1a/2) · **Date:** 2026-08-05

## Context

The original provider adapter used a module-level singleton constructed at
import time, capturing its API key immediately. That made tests order-dependent,
per-workspace keys impossible, and multi-model benchmark runs impossible.

Separately, `LlmResult<T>` carries `provider`, `model`, `requestId`, `sources`,
and `usage`, but none of the cost, timing, or snapshot fields that the cost
ledger and margin reporting need.

## Decision

Three layers, in this order:

1. **Our interfaces on top.** `LlmProvider` splits into `GenerationProvider` and
   `AiBenchmarkProvider` (`src/lib/providers/contracts.ts`). `LlmResult<T>`
   gains `providerVersion`, `requestedAt`, `completedAt`, `costUnits`,
   `currency`, `rawSnapshotRef`, `finishReason`, `cached`.
2. **A registry in the middle.** `src/lib/llm/registry.ts` exposes
   `getProvider(spec)`, `resolveDefault(purpose)`, `listBenchmarkProviders(ctx)`.
   The import-time singleton is deleted.
3. **The official OpenAI SDK underneath, as transport only.** The adapter uses
   the Responses API, native `web_search`, and Structured Outputs through the
   SDK's Zod helper.

**The AI SDK does not become the abstraction.** It carries no `ProviderCall`,
cost, or snapshot semantics, and those are load-bearing for margin reporting.

Every provider call is wrapped by `withProviderCall(ctx, spec, fn)` in
`src/lib/providers/instrument.ts`, which writes the `ProviderCall` row. Adapters
never write it themselves.

Costs come from `src/lib/llm/pricing.ts`, keyed `(provider, model, effectiveFrom)`.
Model prices change; a single hardcoded rate makes historical gross margin
permanently wrong.

## Consequences

- One import site changes today (`brand-profile.ts`). By Phase 6 it would be
  every generation call, so this lands in Phase 1a.
- Streaming is confined to one place: the Phase-6 content editor. Server-side
  pipeline calls stay non-streaming through our own adapters.
- No free-running agent loops. The product principle is "evidence before
  generation" and "snapshots, not mutable reports", which requires a fixed graph
  of typed, auditable steps.
