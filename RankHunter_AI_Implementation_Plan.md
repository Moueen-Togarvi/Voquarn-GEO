# RankHunter AI — Implementation Plan

**Based on:** `Vouarn GEo_Final_PRD.md` v1.0  
**Repository assessed:** Voquarn GEO, August 5, 2026  
**Recommended target:** a trustworthy, paid private beta in 16 weeks  
**Planning assumption:** one product lead/designer, two full-stack engineers, and one AI/data engineer. A solo developer should plan for roughly 28–36 weeks for the same scope.

---

## 1. Executive decision

The six-part product loop is a strong long-term vision:

`HUNT → AUTOPSY → GAP ATTACK → AUTO-BUILD → DEPLOY → MONITOR`

It should not, however, be implemented in that exact order as six isolated feature projects. The product first needs a shared evidence and workflow platform. Every discovery, recommendation, draft, publication, and result must be reproducible, attributable to source data, costed, and safe to retry.

The recommended first sellable product is:

> For one website and a defined market, identify the competitors and pages that actually win Google and AI-source visibility, explain the highest-confidence content opportunities, produce an evidence-backed brief or draft, publish it as a WordPress draft after approval, and show whether visibility improved.

That is narrow enough to ship, broad enough to demonstrate the closed loop, and much safer than beginning with autonomous live publishing.

### Launch principles

1. **Evidence before generation.** No recommendation or factual claim without traceable input data.
2. **Human approval by default.** “Autonomous” initially means automated research and preparation, not unreviewed publication.
3. **One excellent vertical workflow before many shallow integrations.** Start with Google + one AI-answer API benchmark + WordPress.
4. **Snapshots, not mutable reports.** Preserve the inputs that produced every score and recommendation.
5. **Cost and quota are product features.** Every external call needs metering, limits, caching, and attribution to a workspace.
6. **Optimize for useful originality, not word count.** Content completeness, first-party evidence, and intent fit matter more than being 20% longer than a competitor.

---

## 2. PRD assessment

### 2.1 What is strong

- The Conquest Loop is an understandable product narrative and can become the domain model.
- Competitor discovery, page-level weakness analysis, strategy, creation, deployment, and measurement form a genuine end-to-end job.
- The PRD recognizes that Google visibility and AI-answer visibility need different observations.
- Human approval is already acknowledged in the quality-control pipeline.
- The current repository has started with sensible typed boundaries for brands, prompts, runs, analyses, and sources.
- Multi-project support, source capture, provider request IDs, and analysis batches are good foundations for a SaaS product.

### 2.2 Critical PRD corrections

| PRD statement or assumption | Problem | Required correction |
|---|---|---|
| Product is RankHunter AI; repository and workspace say Voquarn GEO; filename says Vouarn | Three identities will leak into UI, API names, emails, domains, and integrations | Decide the canonical product name before auth, billing, OAuth callbacks, or public launch. Rename deliberately in one migration. |
| “World's first” and competitor feature matrix | These are unverified marketing claims and will age quickly | Treat the matrix as research hypotheses. Add dated evidence URLs and an owner/review cadence before using it publicly. |
| “Destroy competitor rankings” positioning | It encourages manipulative output, weakens brand trust, and creates policy risk | Position the product as evidence-led visibility growth and competitive opportunity intelligence. |
| 90 days for six engines, several CMSs, chatbot, billing, monitoring, and compliance | This is multiple products, not one MVP | Use the reduced 12-week concierge beta or the recommended 16-week paid beta below. |
| Next.js 14, Supabase, BullMQ, Pinecone, Puppeteer | The repository already uses Next.js 16, Neon, Prisma, Inngest, and Playwright; several PRD choices duplicate each other | Keep the working stack. Do not add tRPC, Zustand, React Query, BullMQ, Pinecone, Supabase, or Puppeteer until a measured need exists. |
| Google Indexing API for every new article | Google's API is restricted to `JobPosting` and livestream `BroadcastEvent` pages | For ordinary content, update the sitemap, use Search Console verification/inspection where applicable, and let Google crawl normally. Keep IndexNow for participating engines only. |
| FAQ/HowTo schema as a ranking/rich-result attack | Google no longer shows HowTo rich results and restricts FAQ rich results; the PRD overstates visible SEO impact | Generate only schema that truthfully matches visible content. Treat schema as machine-readable semantics, not a guaranteed ranking or rich-result lever. |
| Core Web Vitals includes FID | FID was replaced by INP | Use LCP, INP, and CLS; separate CrUX field data from Lighthouse lab data. |
| Shopify REST endpoints dated `2024-01` | Shopify REST Admin is legacy and the version is obsolete | Use versioned GraphQL Admin API through a dedicated connector. |
| Webflow generic `/collections/{id}/items` examples | Current API uses v2 staged/live publishing semantics and requires schema mapping | Build against Webflow Data API v2 only after WordPress is stable. |
| `cms_credentials JSONB` | Plain JSON credentials are an avoidable breach risk | Store only encrypted connection material, preferably envelope-encrypted with KMS, plus token metadata and scopes. Never return secrets through normal ORM DTOs. |
| “Unlimited” sites, competitors, posts, API access, or rate limits | External provider costs and abuse make unlimited plans economically unsafe | Define included usage, fair-use ceilings, concurrency limits, and overages from the first paid beta. |
| Generate “3+ original statistics” and “2+ expert quotes” | An LLM cannot invent original research or quotes | Require first-party data supplied by the customer or sourced, licensed evidence. Unresolved placeholders block approval and publishing. |
| Beat competitor word count by 20% | Google explicitly says it has no preferred word count; this drives commodity output | Score task completion, intent satisfaction, evidence, originality, structure, and brand expertise. |
| `<5%` plagiarism guarantee | Similarity percentages depend on an index and do not establish originality or copyright safety | Use duplicate/similarity risk signals, source attribution, and human review; never promise a universal percentage. |
| “Time to rank: 2–4 weeks” | It is not supportable before enough first-party outcome data exists | Omit it in v1 or label it an experimental estimate with method, sample size, and confidence. |
| AI citation frequency as a simple count | Model output is stochastic and API output is not necessarily the same as the consumer product UI | Define a benchmark protocol: fixed prompt set, locale, provider, model/version, run count, date, sources, answer snapshot, and denominator. Call it an API visibility benchmark. |
| Automated AI-source monitoring across every platform | Provider terms and output formats differ; some grounded-search terms restrict storing or repurposing links/results | Complete a provider-by-provider legal/terms review and implement separate adapters and retention rules. |
| “Respect robots.txt” plus rotating proxies | Proxy rotation can contradict the stated respectful-crawling posture | Use an identified crawler, robots and content-signal enforcement, rate limits, caching, and a clear opt-out/contact page. Do not use evasion as a normal strategy. |
| Daily monitoring for all tiers | Daily SERP and multi-model runs can consume the full $49 plan margin | Make cadence plan-aware: weekly for entry tier, more frequent only where users pay for it. |

### 2.3 Internal inconsistencies to resolve

- Executive success metrics say 500 / 2,500 / 8,000 customers at months 6 / 12 / 18; revenue projections say 200 / 2,000 / 5,000.
- Month-6 MRR is both $25,000 and $15,000.
- Target LTV is both $900 and $1,800; CAC is both $200 and $150.
- The initial user input includes keyword, industry, geography, and language, while the repository onboarding asks only for name and URL.
- The PRD database uses `User` and `Site`; the repository uses `Workspace` and `Brand`; the UI calls a Brand a Project.
- The PRD says GPT-4o/Claude, while the repository uses OpenAI Responses. Provider choice should be configuration, not product terminology.
- “Google only” appears under “AI search platforms,” conflating Google web rank tracking with AI answer/citation tracking.

These should be fixed in a PRD v1.1 before the beta is priced or marketed.

---

## 3. Current repository baseline

The repository is a useful Phase-1 foundation, not a functioning Conquest Loop yet.

### Implemented

- Next.js 16 / React 19 / TypeScript / Tailwind application shell.
- Neon PostgreSQL through Prisma 7.
- Default workspace and multi-project brand CRUD.
- Brand onboarding from company name and public URL.
- SSRF-conscious URL validation, redirect checking, response limits, and basic HTML extraction.
- OpenAI provider adapter with typed text/JSON results, source metadata, usage, and provider request ID.
- AI-assisted brand description, category, and 2–4 competitor discovery.
- Prisma models for future prompts, analysis batches, prompt runs, run analyses, and sources.
- Inngest client and route skeleton.
- Overview, Prompts, Sources, Models, and Settings navigation.
- Unit, conditional database integration, and onboarding browser test source files.

### Partially implemented

- **Competitors:** names and domains are stored, but there is no SERP evidence, threat scoring, manual confirmation, snapshots, or autopsy.
- **AI visibility:** the schema exists, but prompt creation, execution, analysis, aggregation, and UI do not.
- **Durable jobs:** Inngest is connected but serves zero functions.
- **Multi-tenancy:** a workspace exists, but every request uses one global default workspace and there is no identity or authorization boundary.
- **Sources:** provider source metadata is typed, but onboarding research sources are not persisted.

### Not implemented

- Authentication, membership, roles, invitations, or workspace isolation.
- Target markets, locations, languages, keyword sets, search intent, or customer goals.
- SERP, keyword-volume, backlink, trend, social, or Search Console ingestion.
- Site crawl/sitemap ingestion, page inventory, schema detection, freshness, media, or performance analysis.
- Threat/opportunity scoring or versioned scoring explanations.
- Conquest calendar, content briefs, drafts, claim verification, editor, approvals, or versions.
- CMS integrations, encrypted connections, deployments, rollback, sitemap/IndexNow flow.
- Rank monitoring, weekly reports, alerts, feedback loop, or experiment attribution.
- Usage ledger, entitlements, billing, notifications, analytics, audit log, data export/deletion.
- Widget, RAG ingestion, chatbot, and conversation mining.

### Verification status

The source tree was inspected, but automated checks could not run because local dependencies are absent (`tsc: not found`). The worktree already had a deleted `package-lock.json`; this plan does not alter or restore that user-owned change. Before implementation begins, restore or intentionally regenerate and commit a lockfile, install dependencies, and establish a green build baseline.

---

## 4. Product scope for the first release

### 4.1 Primary beta customer

Start with a marketer or SEO consultant managing one English-language B2B SaaS or content-led business site in one country, using WordPress, with 10–50 commercially relevant topics.

This reduces variability in product catalogs, local SEO, multilingual content, regulated YMYL content, and CMS behavior while the scoring system is calibrated.

### 4.2 Core job-to-be-done

> “Show me which competitor-owned topics and pages are realistically worth attacking, give me evidence for the recommendation, help me produce an expert-reviewed draft, and show me whether it improved qualified search and AI-source visibility.”

### 4.3 Paid-beta scope

Include:

- Secure workspaces, projects, and roles.
- Project configuration: domain, market, language, timezone, goals, topics/keywords, brand voice, competitors.
- Prompt library and repeatable AI visibility benchmark for one or two providers.
- Google SERP discovery through one data provider.
- Competitor threat score with visible components.
- Sitemap crawl and page-level autopsy-lite for the client plus up to five competitors.
- Opportunity radar and a weekly, editable conquest plan.
- Evidence-backed content brief and draft generation.
- Claim/evidence review and hard publishing blockers.
- WordPress connection and **draft** publishing.
- Google Search Console connection, rank snapshots, weekly reporting, and basic before/after attribution.
- Stripe subscription, usage limits, audit trail, and operational dashboards.

### 4.4 Explicitly defer

- Live auto-publish without review.
- Webflow and Shopify until WordPress publish reliability is demonstrated.
- Chat widget and conversation mining; they are a second product and are not required to prove the core loop.
- X, Quora, and Reddit hunting until commercial access, terms, reliability, and customer demand are proven.
- Ahrefs and SEMrush integrations; use a single API-first SEO data supplier initially.
- Autonomous backlink outreach or social activation.
- White-label agency mode, SSO/SAML, custom domains, and unlimited sites.
- Full multi-language and multi-location orchestration.
- Guaranteed plagiarism percentage, rank predictions, or “auto fact-check complete” claims.

---

## 5. Recommended architecture

```text
Next.js UI / Route Handlers
          |
          | short commands and reads
          v
Application services + policy/entitlement checks
          |
          +--------> Neon PostgreSQL / Prisma
          |             canonical state, observations, ledger
          |
          +--------> Inngest workflows
                         durable steps, retries, schedules,
                         per-workspace/provider concurrency
                              |
              +---------------+----------------+
              |               |                |
          SEO adapters     Crawl adapter    LLM adapters
          Scrape.do        fetch first      OpenAI + selected
          GSC / CrUX       browser fallback benchmark APIs
              |               |                |
              +---------------+----------------+
                              |
                    immutable raw snapshots
                       object storage
                              |
                    analysis + opportunity
                              |
                     content state machine
                              |
                   WordPress draft adapter
                              |
                    monitoring observations
```

### 5.1 Keep, add, and avoid

| Concern | Decision |
|---|---|
| Web application | Keep Next.js 16 App Router and React Server Components. Use client state only for interactive editor/filter experiences. |
| API layer | Keep route handlers plus application services. Add OpenAPI only when public/partner API work starts. tRPC is unnecessary for the beta. |
| Database | Keep Neon PostgreSQL and Prisma. Use normal relational tables for business state and JSON only for immutable raw payloads or provider-specific extras. |
| Vector search | Start with `pgvector` in Neon when RAG/topic similarity is needed. Avoid Pinecone until corpus size/latency demonstrates a need for a separate vector service. |
| Workflows | Keep Inngest. Do not add BullMQ. Use steps, idempotency keys, retries, cancellation, schedules, and per-provider/workspace concurrency. |
| Crawl | Keep the secure HTTP reader for fast pages; add sitemap parsing and structured extraction. Use a managed browser/crawl fallback for JavaScript pages instead of running browsers inside request handlers. |
| SEO data | Use Scrape.do's structured Google Search plugin for localized SERP evidence behind one internal adapter. Use GSC for verified first-party outcomes, and evaluate a separate licensed provider if keyword-volume or backlink datasets become necessary. |
| AI providers | Keep the existing `LlmProvider` idea, but split generation from benchmark/search capabilities. Pin model versions for measurements. |
| Auth | Use one workspace-aware auth solution. Clerk Organizations is fastest for B2B beta; a self-hosted alternative lowers vendor cost but increases security/maintenance responsibility. Do not combine Supabase Auth with Neon merely because the PRD listed Supabase. |
| Storage | Use one S3-compatible object store for compressed raw crawl/response snapshots. Store metadata and hashes in PostgreSQL. |
| Editor | Add TipTap or another structured rich-text editor only in the content phase; persist a portable document model plus rendered HTML. |
| Observability | Add Sentry plus structured logs/traces. PostHog is useful for product events but is not a substitute for operational telemetry. |
| Email | Add a transactional provider for invites, job completion, reports, and billing notices. |

### 5.2 Provider contracts

Do not allow application services to depend directly on vendor response shapes. Define capabilities such as:

- `SerpProvider.search(query, market, language, device)`
- `KeywordProvider.metrics(keywords, market, language)`
- `BacklinkProvider.intersection(domains)`
- `CrawlProvider.fetch(url, policy)`
- `AiBenchmarkProvider.run(prompt, locale, modelVersion)`
- `GenerationProvider.generateStructured(schema, evidence, instructions)`
- `AnalyticsProvider.searchPerformance(site, range)`
- `Publisher.validateConnection()` / `createDraft()` / `updateDraft()` / `publish()`
- `NotificationProvider.send(template, recipient, data)`

Each result must include `provider`, `providerVersion`, `requestId`, `requestedAt`, `completedAt`, `costUnits`, `rawSnapshotRef`, and a normalized payload.

### 5.3 Workflow rules

- Route handlers return quickly with `202 Accepted` and an operation/job ID for long work.
- Every external side effect has an idempotency key.
- Every workflow step writes a status and heartbeat.
- Retries must not create duplicate drafts, usage events, or publications.
- Provider rate limits are enforced with global and per-workspace concurrency keys.
- Raw input and normalized output are immutable; derived scores can be regenerated with a new algorithm version.
- Cancellation stops future work but does not delete evidence already collected.
- A failed provider can produce a partial result with an explicit confidence reduction; it must not silently disappear.

---

## 6. Data model evolution

Do not replace the current schema with the simplified SQL in the PRD. Evolve it through reviewed Prisma migrations.

### 6.1 Identity and tenancy

- `User`
- `Workspace`
- `Membership` with `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`
- `Invitation`
- `Subscription`
- `Entitlement`
- `UsageEvent`

Every tenant-owned table must have an efficient path to `workspaceId`. Authorization tests must prove cross-workspace reads and mutations fail.

### 6.2 Project configuration

Choose one canonical noun. Recommended:

- `Project`: the tracked customer initiative.
- `Site`: a verified domain owned by the project.
- `Brand`: identity/profile data used in prompts and content.

If the team wants a smaller migration, retain the current `Brand` model internally for the beta but expose “Project” consistently in the UI. Do not continue mixing `/brands`, `/sites`, and `/projects` indefinitely.

Add:

- `Market` (`country`, optional region/city, language, device, timezone)
- `Topic`
- `Keyword` with normalized form and intent
- `ProjectKeyword` with priority and status
- `BrandVoiceProfile`
- `Goal` and conversion/business-value weighting

### 6.3 Evidence and observations

- `Operation` / `JobRun`
- `ProviderCall`
- `RawSnapshot` (object key, hash, MIME type, retention class)
- `SerpSnapshot`
- `SerpResult`
- `CompetitorObservation`
- `CrawlRun`
- `PageSnapshot`
- `PageObservation`
- `SchemaObservation`
- `PerformanceObservation`
- `AiBenchmarkRun`
- `AiAnswer`
- `Citation`
- `Source`

Observations are timestamped facts. Do not overwrite last position, last schema set, or last response in place.

### 6.4 Strategy and content

- `ScoreDefinition` and version
- `ThreatScore` with component values
- `Opportunity`
- `OpportunityEvidence`
- `ConquestPlan`
- `PlanItem`
- `ContentItem`
- `ContentVersion`
- `Claim`
- `EvidenceLink`
- `Approval`
- `Publication`
- `PerformanceExperiment`

Recommended content state machine:

`PLANNED → RESEARCHING → BRIEF_READY → DRAFTING → IN_REVIEW → CHANGES_REQUESTED → APPROVED → PUBLISHING → PUBLISHED → MONITORING`

Terminal/exception states: `CANCELLED`, `FAILED`, `ARCHIVED`, `ROLLED_BACK`.

### 6.5 Integrations and security

- `IntegrationConnection`: provider, external account/site ID, scopes, status, last validated time.
- `EncryptedSecret`: ciphertext, key version, rotation metadata; inaccessible to ordinary DTO paths.
- `WebhookDelivery`: payload hash, attempts, last response, next retry.
- `AuditEvent`: actor, workspace, action, target, timestamp, safe metadata.
- `ConsentRecord` and `DataDeletionRequest` before collecting end-user conversations.

---

## 7. Scoring model

### 7.1 Threat Score v1

The score must be explainable and versioned, not an opaque LLM opinion.

Suggested 0–100 components:

- 35 points: weighted SERP overlap across tracked keywords.
- 20 points: prominence/position across those SERPs.
- 15 points: source/citation share in the controlled AI benchmark.
- 10 points: authority proxy from the chosen data provider.
- 10 points: publishing activity and relevant freshness.
- 10 points: backlink intersection/gap, only after backlink data is enabled.

Normalize every component for missing data. Show “insufficient evidence” instead of converting missing observations into zero.

### 7.2 Opportunity Score v1

Use a prioritization model, not attack rhetoric:

```text
Opportunity score =
  (business fit × demand × current visibility gap × evidence strength)
  / (estimated effort × competition × risk)
```

Inputs should include:

- Relevance to the customer's products and audience.
- Search demand and trend.
- Current client coverage and position.
- Competitor coverage quality and freshness.
- Dominant search intent.
- Availability of first-party expertise/evidence.
- Expected production effort.
- Cannibalization, compliance, and YMYL risk.

Display the components and why the recommendation was made. An LLM may explain structured scores, but it must not manufacture the scores.

### 7.3 Measurement discipline

- Store the score algorithm version.
- Recalculate old evidence with a new version without losing the original score.
- Separate “unknown” from “poor.”
- Calibrate weights against real beta outcomes.
- Do not expose rank-time predictions until sufficient outcome data exists.

---

## 8. Phased implementation roadmap

The dates below are elapsed project weeks after the plan is approved.

### Phase 0 — Product and engineering contract (Week 0–1)

**Objective:** remove ambiguity before building expensive integrations.

Deliverables:

- Decide canonical name, domain, UI nouns, and repository/package naming.
- Publish PRD v1.1 with corrected scope, metrics, pricing assumptions, and API constraints.
- Define the beta persona, supported content categories, geography/language, and exclusion list.
- Document the benchmark protocol for AI visibility.
- Choose auth, SEO data, object storage, email, observability, and one WordPress authentication path.
- Build a provider cost model for one full weekly loop per site.
- Restore/regenerate the lockfile intentionally; install dependencies; make typecheck, lint, unit tests, and production build green.
- Add CI for format check, typecheck, lint, unit tests, build, migration validation, and Playwright smoke tests.
- Define event names, error taxonomy, operation statuses, retention rules, and logging redaction.

Exit criteria:

- Architecture decision records are approved.
- One beta workflow and its acceptance test are written end-to-end.
- There are no contradictory product metrics or unbounded “unlimited” entitlements.
- Main branch is reproducibly green from a clean checkout.

### Phase 1 — Secure SaaS foundation (Weeks 1–2)

**Objective:** make every later feature tenant-safe, observable, and billable.

Deliverables:

- Authentication, sign-in/out, account recovery, and protected routes.
- Workspace membership, roles, invitations, and active workspace selection.
- Replace the global default-workspace behavior with request-scoped authorization.
- Project onboarding v2: URL, target market, language, timezone, goals, initial topics/keywords.
- Manual review/edit of AI-discovered profile and competitors before persistence.
- `Operation`, `ProviderCall`, `UsageEvent`, `AuditEvent`, and integration metadata tables.
- Inngest base functions with typed events, idempotency, retry policies, cancellation, and per-workspace concurrency.
- Structured logging, error reporting, trace/job ID in UI error states.
- Entitlement service with code-level limits even before Stripe is connected.

Acceptance tests:

- User A cannot read, mutate, enumerate, or trigger work for User B's workspace.
- Replaying an onboarding/job event does not duplicate data or usage.
- A failed external call is visible, retryable, and does not leak credentials.
- All long operations return an operation ID and expose progress.

Exit gate:

- Security review of tenant isolation passes.
- One complete example Inngest workflow survives forced retry and cancellation.

### Phase 2 — Repeatable AI visibility measurement (Weeks 3–4)

**Objective:** finish the measurement foundation already represented in the schema.

Deliverables:

- Generate 20–30 buyer prompts across category, comparison, use-case, and brand-specific intent.
- Prompt review UI: edit, add, disable, group, bulk approve.
- A pinned provider/model connector for the first benchmark, with locale and run metadata.
- Durable batch execution and normalized answer parsing.
- Brand mention, mention order, sentiment, competitor mentions, sources, and citation extraction.
- Store answer snapshots, sources, token/usage cost, provider request IDs, and errors.
- Visibility, share-of-voice, sentiment, and source dashboards with sample size and date range.
- Run comparison and rerun controls.

Measurement definition:

- `Visibility = prompts with a brand mention / successfully completed prompts`.
- `Share of voice = brand mentions / all tracked-brand mentions` within the same run set.
- Keep citations separate from other provider-retrieved sources.
- Report partial failure and sample size; never silently use total configured prompts as the denominator.

Acceptance tests:

- Fixtures cover citations, no mentions, multiple mentions, refusal, malformed output, timeout, and partial batch failure.
- Rerunning the same batch creates a new observation set, not overwritten results.
- Aggregates exactly reconcile to underlying runs.

Exit gate:

- Five internal projects can run the same prompt set twice and the team can explain expected variability.
- Per-run cost is visible and within the Phase-0 budget.

### Phase 3 — HUNT: Google competitor discovery (Weeks 5–6)

**Objective:** replace LLM-only competitor guesses with market evidence.

Deliverables:

- Scrape.do adapter for location/language/device-specific structured Google results.
- Project keyword/topic import and validation.
- SERP hunt workflow with batch scheduling, caching, deduplication, canonical-domain normalization, and aggregator/exclusion rules.
- Store immutable SERP snapshots and normalized results.
- Candidate competitor aggregation across keywords.
- Threat Score v1 with visible components, confidence, evidence links, and score version.
- Merge AI-discovered competitors with SERP-discovered candidates; let users accept, ignore, or pin competitors.
- Competitor list and detail page with “why this competitor” evidence.
- First usage limits and provider-budget cutoffs.

Do not include yet:

- Social hunting.
- Full backlink acquisition.
- Unsupported “DR” values; show the chosen provider's named authority metric.

Acceptance tests:

- Location and language are always present in provider calls and cache keys.
- Client domain, subdomains, duplicate canonical domains, and configured aggregators are handled predictably.
- Missing authority or freshness data reduces confidence rather than creating fake zeroes.
- Threat score calculation is deterministic for a fixed snapshot.

Exit gate:

- For 20 validation projects, accepted top-five competitors are judged relevant at least 80% of the time.

### Phase 4 — AUTOPSY: page evidence and gaps (Weeks 7–8)

**Objective:** explain how competitors win and identify addressable weaknesses.

Deliverables:

- Crawler identity and policy page, robots handling, per-host throttling, cache, and opt-out process.
- Sitemap discovery, canonicalization, include/exclude rules, and crawl budgets.
- Static HTTP extraction first; managed browser fallback for JavaScript-rendered pages.
- Page inventory: URL, canonical, title, description, headings, main content, word count, internal/external links, images/video, dates, and content hash.
- JSON-LD extraction and schema validation against visible content.
- Intent classification and topic clustering.
- Client-versus-competitor coverage comparison.
- Freshness evidence with confidence: sitemap `lastmod`, structured dates, visible dates, headers, and content-change history. Do not trust one header as truth.
- PageSpeed/CrUX adapter using LCP, INP, and CLS; label field versus lab data.
- Autopsy report with strengths, weaknesses, evidence, data date, and uncertainty.

Acceptance tests:

- Crawl security covers private IPs, redirect chains, DNS rebinding controls, oversized bodies, non-HTML, compression bombs, and slow responses.
- Robots-denied URLs are never fetched by the crawl workflow.
- Extraction fixtures cover WordPress, Webflow, client-rendered pages, malformed JSON-LD, and missing sitemaps.
- Every reported weakness links to one or more observations.

Exit gate:

- Crawl success exceeds 85% on the beta-site sample without violating configured policies.
- Users can verify the evidence behind every autopsy finding.

### Phase 5 — GAP ATTACK: opportunity radar and plan (Weeks 9–10)

**Objective:** turn observations into a small, defensible weekly plan.

Deliverables:

- Opportunity Score v1 and explicit business-value inputs.
- Detect missing coverage, weak coverage, stale-but-still-relevant pages, intent mismatch, comparison opportunities, and source/citation gaps.
- Cannibalization check against the client's existing inventory.
- LLM explanation constrained to structured evidence.
- Editable weekly plan with 1–3 recommended actions, not a forced Monday/Wednesday/Friday publishing quota.
- Opportunity lifecycle: `NEW`, `ACCEPTED`, `DEFERRED`, `DISMISSED`, `IN_PROGRESS`, `COMPLETED`.
- Capture dismiss/defer reasons for score calibration.
- Export brief and assign owner/due date.

Acceptance tests:

- An opportunity cannot exist without evidence and a score version.
- The same topic is not recommended as multiple competing new pages.
- Low-confidence data is labeled and cannot be auto-approved.
- Dismissed opportunities are not recreated every week unless material evidence changes.

Exit gate:

- At least 60% of beta users accept one of the top three weekly opportunities, or the scoring model is revised before content automation expands.

### Phase 6 — AUTO-BUILD: evidence-backed brief and draft (Weeks 11–12)

**Objective:** accelerate high-quality production without inventing expertise.

Deliverables:

- Structured research packet from permitted sources and customer-provided material.
- Brief generator: audience, intent, angle, outline, coverage goals, evidence, first-party inputs needed, internal-link candidates, visual/table suggestions, and applicable schema.
- Content editor with autosave and immutable versions.
- Draft generation in bounded sections through durable workflow steps.
- Claim extraction and claim-to-source mapping.
- Hard flags for unsupported facts, invented quotes, unresolved placeholders, stale evidence, risky medical/legal/financial claims, and close paraphrase/similarity.
- Brand voice profile from explicitly approved samples.
- SEO and accessibility validation: title/description, heading hierarchy, link validity, image alt suggestions, canonical intention, and schema-content match.
- Approval workflow and audit trail.
- Social/email derivatives only as manual exports after the core draft passes review.

Quality score dimensions:

- Intent satisfaction.
- Original contribution / first-party expertise.
- Evidence coverage and source quality.
- Completeness without unnecessary length.
- Brand and audience fit.
- Readability and accessibility.
- Internal-link relevance.
- Policy/compliance risk.

Acceptance tests:

- `[SOURCE NEEDED]`, `[EXPERT NEEDED]`, or unresolved placeholders block approval.
- Every factual claim has a source, is explicitly marked opinion/first-party input, or is removed.
- A failed section retry does not duplicate content.
- Approved versions are immutable; edits create a new version and invalidate approval.

Exit gate:

- Human reviewers approve at least 60% of drafts after no more than one substantive revision.
- No critical unsupported-claim defects in the release sample.

### Phase 7 — DEPLOY + MONITOR: WordPress and outcomes (Weeks 13–14)

**Objective:** close the loop safely with one CMS and reliable first-party outcome data.

Deliverables:

- Encrypted WordPress Application Password connection, scope/permission validation, rotation/revoke flow.
- Discover WordPress capabilities and configured SEO plugins; do not assume a custom RankHunter endpoint exists.
- Idempotent create/update **draft** publication with title, slug, body, excerpt, categories/tags, and media where supported.
- Schema delivery only where the site's actual connector/plugin supports it; otherwise provide validated markup for manual/template integration.
- Publication preview, final diff, approval, external ID/URL, last sync, and rollback metadata.
- Search Console OAuth and daily import of query/page clicks, impressions, CTR, and average position.
- Scrape.do rank snapshots for configured priority keywords.
- IndexNow submission for participating engines where site ownership/key setup is valid.
- Weekly report: work completed, evidence changes, visibility outcomes, failures, cost, and next recommendations.
- Simple experiment windows connecting a publication to baseline and later observations without claiming causal certainty.

Acceptance tests:

- Retry cannot create two WordPress posts.
- Revoked credentials fail closed and generate an actionable reconnect notice.
- Content remains a draft unless a separate, recent approval authorizes live publication.
- A WordPress-side edit is detected and never overwritten silently.
- Search Console imports are idempotent and account for delayed/incomplete data.

Exit gate:

- At least 95% of publish attempts on beta WordPress configurations succeed or fail with a recoverable explanation.
- No duplicate or unintended live publications during beta.

### Phase 8 — Billing, hardening, and paid private beta (Weeks 15–16)

**Objective:** charge safely and operate the product with real customers.

Deliverables:

- Stripe checkout, customer portal, subscription lifecycle webhooks, entitlement changes, grace period, and cancellation.
- Included quotas for sites, tracked prompts/keywords, crawled pages, benchmark runs, drafts, and publication connections.
- Usage page and pre-limit notifications.
- Support/admin tools that are audited and tenant-safe.
- Data export and account/workspace deletion workflow.
- Backup and restore test; incident response and credential-rotation runbooks.
- Accessibility, responsive UI, performance, browser compatibility, and failure-state pass.
- Security review, dependency scan, secret scan, webhook signature validation, rate-limit review, and penetration-test checklist.
- Beta onboarding, feedback instrumentation, and weekly product review.

Exit criteria:

- Five design partners complete the loop without engineering database edits.
- At least three customers pay and repeat a second weekly loop.
- Provider gross margin is measured per account and meets the agreed threshold.
- Critical security, data-loss, duplicate-publication, and billing defects are zero.

---

## 9. What fits in the original 90 days

A 12-week **concierge beta** is realistic if scope is fixed to:

- Weeks 1–2: Phase 0 plus essential tenant auth and project configuration.
- Weeks 3–4: prompt library and one AI visibility benchmark provider.
- Weeks 5–6: Scrape.do Google HUNT and explainable competitor list.
- Weeks 7–8: sitemap crawl and autopsy-lite.
- Weeks 9–10: top-three opportunities and evidence-backed briefs.
- Weeks 11–12: content draft editor, approval, and operational hardening.

For this 90-day version:

- WordPress publishing is manual copy/export or a limited internal alpha.
- Search Console can be connected if schedule permits, but full attribution is not a launch blocker.
- Billing may be handled through manually provisioned Stripe subscriptions for a small design-partner cohort.
- No widget, social hunter, Webflow, Shopify, full backlink spy, white-labeling, or live autopublish.

Calling the original full PRD “launched” after 90 days would create a fragile demo. Calling this reduced version a private beta is credible.

---

## 10. Post-beta expansion

### Expansion A — Better monitoring and rescue mode

- Multiple observation windows and anomaly detection.
- Competitor content-change alerts based on content hashes.
- Rescue workflows for meaningful drops, with seasonality and data-delay guards.
- Better experiment attribution using GSC page/query cohorts.
- Calibrate opportunity weights against accepted, published, and successful work.

### Expansion B — More CMSs

1. Webflow Data API v2 staged/live items and schema mapping.
2. Shopify GraphQL Admin API for blog content; product mutation requires a separate commerce safety review.
3. Generic signed webhook connector with schema versioning and delivery replay.

Each connector needs a capability matrix; “publish,” “set SEO fields,” “upload media,” and “inject head schema” are separate capabilities.

### Expansion C — Multi-provider AI visibility

- Add provider adapters only after terms and retention review.
- Pin models where possible and expose model/version changes in reports.
- Run repeated samples for variance and confidence intervals.
- Distinguish API benchmark results from consumer ChatGPT, Gemini, Claude, Perplexity, or Copilot surfaces.
- Never compare providers using different prompt sets, dates, locales, or sample sizes without labeling the mismatch.

### Expansion D — Backlinks and external demand signals

- Evaluate a licensed backlink-data provider; Scrape.do is used for SERPs and does not replace a backlink index.
- Trends and demand signals through licensed APIs.
- Reddit/X/Quora only after approved commercial access and data-use review.
- No automated outreach or astroturfing.

### Expansion E — Conversation intelligence

Build the widget only if interviews show that chatbot-derived questions improve opportunity acceptance or content performance enough to justify a separate ingestion/privacy surface.

Prerequisites:

- Site ownership verification.
- Consent and privacy configuration.
- PII redaction and configurable retention.
- Prompt-injection defense and source allowlists.
- RAG evaluation set, citation behavior, escalation, abuse controls, and deletion/export.

---

## 11. Testing and quality strategy

### Unit tests

- URL/domain normalization and SSRF policy.
- Provider response parsers and normalized schemas.
- Threat and opportunity scoring, missing-data behavior, and versioning.
- Visibility/share-of-voice aggregation and denominators.
- Entitlements, usage ledger, state transitions, and authorization policies.
- Content validation, placeholders, claims, evidence, and schema-content match.

### Integration tests

- Prisma migrations against an isolated Neon/PostgreSQL database.
- Workspace isolation on every service method.
- Inngest workflows with retries, cancellation, partial failure, and idempotency.
- Provider adapters against recorded/redacted fixtures, plus small scheduled live contract tests.
- OAuth/webhook signature and token refresh flows.
- WordPress create/update/retry/revocation behavior.

### End-to-end tests

1. Sign up → create workspace → onboard project → approve profile.
2. Generate/approve prompts → run benchmark → inspect sources.
3. Run hunt → accept competitor → view threat evidence.
4. Run autopsy → accept opportunity → generate brief/draft.
5. Resolve claim blockers → approve → create WordPress draft.
6. Import outcome data → view weekly report.
7. Reach quota → see warning → upgrade → resume operation.
8. Invite editor/viewer → verify permissions.

### Non-functional tests

- Load and cost tests for 100 concurrent weekly project runs.
- Per-host crawler throttling and provider quota exhaustion.
- Accessibility to WCAG 2.2 AA for core flows.
- Backup restore and deletion/export drills.
- Secret leakage and log redaction tests.
- Chaos tests for timeouts, 429s, provider schema drift, duplicate webhooks, and expired tokens.

### Release gates

- No Sev-1/Sev-2 open issue.
- Green build, migration, unit, integration, and critical E2E suites.
- No cross-tenant authorization failure.
- No unresolved critical content claim can be published.
- Provider cost regression below the agreed threshold.
- Rollback and incident paths tested for every external side effect.

---

## 12. Security, privacy, and compliance plan

### Before any public preview

- Add authentication and workspace authorization; the README correctly warns that the current no-auth app must not be public.
- Encrypt integration secrets with envelope encryption and rotation support.
- Validate OAuth `state`, PKCE where applicable, webhook signatures, replay windows, and redirect allowlists.
- Apply rate limits by IP, user, workspace, site, route, and provider-cost class.
- Maintain request/body size limits and safe error messages.
- Extend SSRF controls to prevent DNS time-of-check/time-of-use rebinding and control outbound egress.
- Add CSP, secure cookies, CSRF protections where needed, clickjacking protection, and dependency/secret scanning.

### Before chatbot/conversation collection

- Consent notice and configurable data-processing terms.
- PII detection/redaction before analytics or embeddings.
- Per-workspace retention, export, and deletion.
- Do not use customer conversations to train shared models without explicit agreement.
- Abuse reporting, prompt injection controls, and a documented subprocessors list.

### Compliance realism

- GDPR/CCPA are ongoing operational programs, not feature checkboxes.
- SOC 2 Type II requires an observation period and operating evidence; start controls and evidence collection early, but do not promise completion merely from implementing encryption.
- Review crawling, AI provider, SERP data, and social-platform terms with counsel before commercial scale.

---

## 13. Observability and operations

Every operation should answer:

- Who/workspace initiated it?
- Which project, prompt, keyword, URL, content version, and provider were involved?
- Which job and step are running?
- What input snapshot and algorithm version produced the output?
- How long did it take, what did it cost, and how many retries occurred?
- Was the result complete, partial, stale, or low confidence?
- Did it create an external side effect, and can that side effect be reconciled?

Minimum dashboards:

- Workflow completion, failure, retry, and queue age.
- Provider latency, status, 429 rate, schema drift, and cost.
- Crawl success/deny/error by host and extraction mode.
- AI benchmark success and variance.
- Draft approval/revision rate and content blockers.
- Publication success, duplicate prevention, and drift.
- Usage and gross margin by plan/workspace.
- Product activation and weekly loop completion.

---

## 14. Pricing and unit economics changes

Do not launch the PRD pricing table unchanged.

### Required cost ledger

Record at least:

- SERP requests and rows.
- Keyword/backlink requests and rows.
- Crawl pages, bytes, and browser seconds.
- LLM input/output/cached tokens by provider/model/purpose.
- AI benchmark runs and grounded-search calls.
- Embedding tokens and stored vectors.
- Object storage and bandwidth.
- Email/report sends.
- Human support or concierge time during beta.

### Safer packaging

- Price around sites plus included monthly usage.
- Separate tracked prompts/keywords from generated drafts.
- Make monitoring frequency a plan feature.
- Use overage packs or hard caps, not “unlimited.”
- Keep live autopublishing an opt-in capability after a trust period, not simply a higher-tier switch.
- Recalculate gross margin with real beta behavior before public pricing.

Stripe meters can support usage-based components, but the internal immutable usage ledger remains the source for entitlement enforcement and reconciliation.

---

## 15. Success metrics for the beta

### North-star behavior

**Weekly Evidence-to-Action Rate:** percentage of active projects that accept and complete at least one evidence-backed opportunity in a week.

This is better during beta than raw content volume because it measures whether intelligence causes useful action.

### Activation

- Project configured and profile approved.
- First prompt benchmark completed.
- First hunt/autopsy completed.
- User accepts or dismisses an opportunity with a reason within 24 hours.

### Quality

- Competitor top-five relevance ≥80% on reviewed sample.
- Top-three opportunity acceptance ≥60%.
- Draft approval after ≤1 substantive revision ≥60%.
- Unsupported critical claim escapes: zero.
- WordPress draft publish success ≥95%.

### Reliability and economics

- Core API availability ≥99.9% after paid launch.
- Durable job completion ≥98%, excluding valid policy/permission denials.
- Duplicate external side effects: zero.
- Provider gross margin measured per workspace and plan.
- Weekly report delivered on time ≥99%.

### Outcomes

- GSC clicks, impressions, CTR, and position by accepted opportunity/page cohort.
- AI benchmark visibility and source share with sample sizes.
- Time from accepted opportunity to approved/published content.
- Retention by number of completed weekly loops, not login count alone.

Do not promise an average rank gain until there is a defined cohort, baseline window, observation window, sample size, and survivor-bias treatment.

---

## 16. Team execution model

### Suggested ownership

- **Product lead/designer:** PRD v1.1, customer discovery, scoring explanations, approval UX, metrics, beta operations.
- **Full-stack engineer A:** auth/tenancy, project UI, content editor, billing, WordPress.
- **Full-stack/platform engineer B:** data model, Inngest workflows, operations, observability, GSC.
- **AI/data engineer:** provider adapters, prompt benchmark, SERP normalization, crawling/extraction, scoring, evidence/claim pipeline.

### Development rhythm

- One vertical slice per phase, demoed against realistic fixtures and at least one live design-partner site.
- Architecture decision records for vendor/security choices.
- Weekly cost and quality review, not only sprint velocity.
- Feature flags for every provider, publisher, and autonomous action.
- Migrations are forward-only, reviewed, and tested against a production-like copy/branch.

---

## 17. First implementation backlog

Execute these in order after Phase-0 decisions:

1. Restore a reproducible install and green CI baseline.
2. Decide and apply the canonical product/domain vocabulary.
3. Add identity, `Membership`, and request-scoped workspace authorization.
4. Add project market/language/timezone/goals and structured keyword/topic models.
5. Add `Operation`, `ProviderCall`, `UsageEvent`, and `AuditEvent`.
6. Implement one durable Inngest test workflow with idempotency and cancellation.
7. Build prompt generation/review on the existing `Prompt` model.
8. Implement benchmark execution on `AnalysisBatch` / `PromptRun` and persist sources.
9. Build exact aggregate queries and the first real Overview dashboard.
10. Add the Scrape.do adapter and immutable SERP snapshots.
11. Implement deterministic Threat Score v1 and competitor review.
12. Add sitemap/page crawling and normalized page observations.
13. Build Opportunity Score v1 and top-three weekly plan.
14. Build evidence packet, brief, claims, content versions, and approval states.
15. Add encrypted WordPress connection and idempotent draft publishing.
16. Add Search Console import and weekly outcome report.
17. Add Stripe, quotas, data export/deletion, and beta hardening.

---

## 18. Decisions needed before coding Phase 1

1. Is the canonical product name **RankHunter AI** or **Voquarn GEO**?
2. Is the first beta strictly B2B SaaS/content sites, or must it support e-commerce immediately?
3. Which country/language is the first supported market?
4. Is WordPress the required first CMS?
5. Which auth approach will the team own: managed B2B organizations or self-hosted auth?
6. Which AI provider is the first controlled visibility benchmark, and do its terms allow the required storage/analysis?
7. What is the maximum provider cost per active site per month at each planned price?
8. What content categories are prohibited or require enhanced review?
9. Is live publishing forbidden during beta, as recommended?
10. What outcome makes the beta successful enough to expand: paid retention, accepted opportunities, published drafts, or measured visibility improvement?

---

## 19. Current official references that affect the plan

- Google restricts the Indexing API to job posting and livestream event pages: <https://developers.google.com/search/apis/indexing-api/v3/quickstart>
- Google has deprecated HowTo rich results and severely restricted FAQ rich results: <https://developers.google.com/search/blog/2023/08/howto-faq-changes>
- Google replaced FID with INP: <https://web.dev/articles/fid>
- Google warns against scaled, low-value AI content and says there is no preferred word count: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Google's current AI-search guidance emphasizes non-commodity, people-first content over GEO hacks: <https://developers.google.com/search/docs/fundamentals/ai-optimization-guide>
- Shopify REST Admin is legacy; new integrations should use GraphQL Admin: <https://shopify.dev/docs/api/admin-rest/latest>
- Webflow CMS uses Data API v2 staged/live item semantics: <https://developers.webflow.com/data/v2.0.0/docs/working-with-the-cms>
- Search Console exposes query/page clicks, impressions, CTR, and average position, with limits and delayed/incomplete data: <https://developers.google.com/webmaster-tools/v1/searchanalytics/query>
- PageSpeed Insights recommends CrUX APIs for field data as PSI field data is being discontinued: <https://developers.google.com/speed/docs/insights/v5/get-started>
- Inngest supports step retries and keyed concurrency appropriate for provider quotas: <https://www.inngest.com/docs/features/inngest-functions/error-retries/retries> and <https://www.inngest.com/docs/functions/concurrency>
- Neon supports pgvector, avoiding a separate vector database at early scale: <https://neon.com/docs/extensions/pgvector>
- Scrape.do's Google Search plugin returns localized, structured SERP results including organic listings and AI Overview references: <https://scrape.do/documentation/google-scraper-api/search/search/>
- WordPress supports REST post creation and Application Password authentication: <https://developer.wordpress.org/rest-api/reference/posts/> and <https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/>
- Stripe supports usage meters and idempotent usage event identifiers: <https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure>

---

## Final recommendation

Build the product around a trustworthy evidence graph and durable workflow, not around a large collection of agents. The strategic moat will not be the number of LLM calls or generated posts. It will be the accumulated relationship between observations, accepted recommendations, content decisions, publications, and verified outcomes for each market.

Ship the reduced 12-week concierge beta if speed is the overriding constraint. Ship the 16-week plan if the goal is a credible paid beta with safe WordPress deployment and outcome monitoring. Defer the widget, social hunter, additional CMSs, and unreviewed automation until the core loop proves that customers repeatedly act on—and benefit from—the recommendations.
