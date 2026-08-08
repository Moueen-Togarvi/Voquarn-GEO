# Event and error taxonomy

Names are frozen once a function is deployed — Inngest matches on the literal
string. Add new events rather than renaming existing ones.

## Naming

`<domain>/<noun>.<past-or-requested-verb>`

`.requested` starts work. `.completed` and `.failed` are terminal. Nothing else
is emitted for a lifecycle stage that has no consumer — add the event when the
consumer exists.

## Events

Schemas live in `src/lib/inngest/events.ts` via `EventSchemas.fromZod`.

### Phase 1a

| Event                            | Payload                                                       | Emitted by                                                                    |
| -------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `brand/discovery.requested`      | `workspaceId`, `brandId`, `operationId`, `websiteUrl`, `name` | `POST /api/brands`                                                            |
| `brand/discovery.completed`      | `workspaceId`, `brandId`, `operationId`                       | `brandDiscovery`                                                              |
| `brand/discovery.failed`         | `workspaceId`, `brandId`, `operationId`, `errorCode`          | `brandDiscovery` `onFailure`                                                  |
| `competitor/expansion.requested` | `workspaceId`, `brandId`, `operationId`                       | `brandDiscovery` step; manual `POST /api/brands/[brandId]/competitors/expand` |
| `storage/snapshot.gc`            | —                                                             | cron                                                                          |

### Phase 2

| Event                          | Payload                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `benchmark/batch.requested`    | `workspaceId`, `brandId`, `batchId`, `marketId`, `repetitions`               |
| `benchmark/run.requested`      | `workspaceId`, `batchId`, `promptId`, `provider`, `model`, `repetitionIndex` |
| `benchmark/batch.completed`    | `workspaceId`, `batchId`                                                     |
| `prompts/generation.requested` | `workspaceId`, `brandId`, `operationId`                                      |

### Phase 3

| Event                             | Payload                                             |
| --------------------------------- | --------------------------------------------------- |
| `hunt/serp.requested`             | `workspaceId`, `brandId`, `marketId`, `operationId` |
| `hunt/serp.keyword.requested`     | `workspaceId`, `keywordId`, `marketId`, `device`    |
| `hunt/threat.recompute.requested` | `workspaceId`, `brandId`, `scoreDefinitionId`       |
| `gsc/import.requested`            | `workspaceId`, `siteId`, `from`, `to`               |

### Phases 4–7

| Event                          | Payload                                          |
| ------------------------------ | ------------------------------------------------ |
| `crawl/run.requested`          | `workspaceId`, `crawlRunId`, `host`              |
| `crawl/page.requested`         | `workspaceId`, `crawlRunId`, `url`, `host`       |
| `opportunity/detect.requested` | `workspaceId`, `brandId`, `operationId`          |
| `content/brief.requested`      | `workspaceId`, `contentItemId`, `operationId`    |
| `content/draft.requested`      | `workspaceId`, `contentItemId`, `operationId`    |
| `publish/draft.requested`      | `workspaceId`, `publicationId`, `idempotencyKey` |
| `report/weekly.requested`      | `workspaceId`, `brandId`, `weekStart`            |

`workspaceId` appears on **every** event. It is the concurrency key and the
usage-attribution key, which is why it is denormalized onto the child tables in
the Phase-1a migration.

## Concurrency keys

| Scope                      | Key                      | Limit          |
| -------------------------- | ------------------------ | -------------- |
| Per workspace, LLM work    | `event.data.workspaceId` | 4              |
| Per provider, account-wide | `event.data.provider`    | provider quota |
| Per crawl host             | `event.data.host`        | 2              |

## Operation kinds

`BRAND_DISCOVERY`, `PROMPT_GENERATION`, `BENCHMARK_BATCH`,
`COMPETITOR_EXPANSION`, `SERP_HUNT`, `THREAT_SCORE`, `CRAWL`,
`OPPORTUNITY_DETECT`, `CONTENT_BRIEF`, `CONTENT_DRAFT`, `PUBLICATION`,
`GSC_IMPORT`, `WEEKLY_REPORT`.

Statuses: `PENDING → RUNNING → (COMPLETED | PARTIAL | FAILED | CANCELLED)`.

`PARTIAL` is a real outcome, not a failure. A provider that returned some of the
requested data produces a result with reduced confidence — it must never
silently disappear.

## Error codes

`src/lib/api/error-codes.ts` holds these as a union type. In use today:

| Code                    | Status |
| ----------------------- | ------ |
| `INVALID_JSON`          | 400    |
| `VALIDATION_ERROR`      | 400    |
| `CONFIRMATION_MISMATCH` | 400    |
| `UNSAFE_WEBSITE_URL`    | 400    |
| `BRAND_NOT_FOUND`       | 404    |
| `COMPETITOR_NOT_FOUND`  | 404    |
| `MARKET_NOT_FOUND`      | 404    |
| `PROMPT_NOT_FOUND`      | 404    |
| `BATCH_NOT_FOUND`       | 404    |
| `SITE_NOT_FOUND`        | 404    |
| `INTEGRATION_NOT_FOUND` | 404    |
| `OPERATION_NOT_FOUND`   | 404    |
| `DUPLICATE_BRAND`       | 409    |
| `CONNECTION_REVOKED`    | 409    |
| `DISCOVERY_FAILED`      | 502    |
| `PROVIDER_ERROR`        | 502    |
| `AI_NOT_CONFIGURED`     | 503    |
| `QUOTA_EXCEEDED`        | 402    |
| `FORBIDDEN`             | 403    |
| `RATE_LIMITED`          | 429    |
| `UNAUTHENTICATED`       | 401    |
| `NO_ACTIVE_WORKSPACE`   | 404    |
| `INTERNAL_ERROR`        | 500    |

Planned — Phase 4 onward: `CONTENT_BLOCKED` 422.

Error messages are safe to show a user. Provider payloads, credentials, and
stack traces go to logs, never to a response body.

## Logging redaction

Never log: API keys, `EncryptedSecret` ciphertext or plaintext, OAuth tokens,
session cookies, full page HTML, or full LLM answers. Log the snapshot reference
instead — the content is retrievable from storage by anyone authorized to see it.
