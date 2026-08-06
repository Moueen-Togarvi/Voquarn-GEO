# Provider cost model

**Status: template. Every number below is a placeholder until measured.**

This document gates pricing. It must be filled in with real figures from the
Phase 2, 3, and 4 exit checks before any plan is priced or sold. A phase is not
complete if it breaks the unit economics recorded here.

## Why this exists

The PRD proposes "unlimited" sites, competitors, posts, and API access at $49.
External provider costs make that economically unsafe. Daily SERP and
multi-model benchmark runs can consume an entire entry-tier plan's margin.

## The unit: one full weekly loop, one site

| Stage                        | Driver                             | Qty        | Unit cost | Cost  |
| ---------------------------- | ---------------------------------- | ---------- | --------- | ----- |
| Benchmark                    | prompts × repetitions × models     | 30 × 3 × 1 |           |       |
| Benchmark tokens             | input + output tokens              |            |           |       |
| SERP hunt                    | keyword × market × device requests | 50         |           |       |
| SERP cache hits avoided      |                                    |            |           |       |
| Crawl (client)               | pages fetched                      | 100        |           |       |
| Crawl (competitors)          | pages × 5 competitors              | 250        |           |       |
| Browser renders              | JS pages needing a renderer        |            |           |       |
| CrUX / PSI                   | URL checks                         |            |           |       |
| Embeddings                   | tokens embedded                    |            |           |       |
| Brief generation             | input + output tokens              |            |           |       |
| Draft generation             | input + output tokens              |            |           |       |
| Claim extraction             | input + output tokens              |            |           |       |
| Object storage               | GB stored + GB transferred         |            |           |       |
| Email                        | report + alert sends               |            |           |       |
| **Total per site per week**  |                                    |            |           |       |
| **Total per site per month** |                                    |            |           | ×4.33 |

## Ledger fields

`UsageEvent` and `ProviderCall` must together record enough to reproduce every
row above:

SERP requests and rows · keyword and backlink requests and rows · crawl pages,
bytes, and browser seconds · LLM input, output, and cached tokens by provider,
model, and purpose · benchmark runs and grounded-search calls · embedding tokens
and stored vectors · object storage bytes and bandwidth · email sends · human
concierge minutes during beta.

Pricing is date-effective, keyed `(provider, model, effectiveFrom)`. Model prices
change; a single hardcoded rate makes historical margin permanently wrong.

## Packaging rules

- Price around **sites plus included monthly usage**.
- Tracked prompts/keywords and generated drafts are separate meters.
- **Monitoring frequency is a plan feature** — weekly on the entry tier, more
  frequent only where the customer pays for it.
- Overage packs or hard caps. Never "unlimited".
- Live autopublishing is an opt-in capability earned after a trust period, not a
  higher-tier switch.
- The internal `UsageEvent` ledger is the source of truth for entitlement
  enforcement. Stripe meters are for invoicing only.

## Gate

Recalculate gross margin per workspace and per plan with real beta behaviour
before any public pricing. Target margin: **TBD — set before Phase 8.**
