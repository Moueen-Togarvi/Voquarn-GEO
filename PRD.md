# Voquarn GEO Platform — Product Requirements Document (PRD)

> **Purpose of this document.** This is the single source of truth for the
> Voquarn GEO Platform. If you are a developer or an AI model picking up this
> project cold, read this file top to bottom first. It explains _what_ the
> product is, _why_ each part exists, _how_ the code is structured, exactly
> _which_ files do what, what is _done_ vs _pending_, and how to _run and
> continue_ the work. It is written to be self-contained — you should not need
> to guess anything about the architecture after reading it.
>
> Last updated: reflects the codebase through **Phase 2.5** complete, with
> **Phase 3.1 (billing) partially started** (schema only). See §10 Status.

---

## 1. What is this product?

**Voquarn** is a SaaS platform for **Generative Engine Optimization (GEO)** —
the practice of getting a brand mentioned and cited inside the answers that AI
assistants (ChatGPT, Claude, Gemini, Perplexity) give to real users.

Traditional SEO optimizes for Google's ranked links. GEO optimizes for being
_named and cited in the AI's generated answer_. When someone asks ChatGPT "what
are the best product-analytics tools?", a brand either appears in that answer or
it doesn't. Voquarn measures that, and helps fix it.

The product is a **closed loop**: **track → fix → re-track.**

### Two modules

1. **Monitoring** (Phase 1 — DONE). Tracks whether a brand is mentioned across
   the four major AI engines. It runs realistic buyer-intent prompts through
   each engine, detects brand & competitor mentions, sentiment, and cited
   sources, then computes visibility metrics (mention rate, share of voice,
   citation rate).

2. **Execution** (Phase 2 — DONE). Turns monitoring gaps into action. It finds
   prompts where competitors win and the brand is absent, then generates
   GEO-optimized content (comparison articles, FAQs, answer snippets), technical
   assets (JSON-LD schema, `llms.txt`, IndexNow), and off-site source/outreach
   opportunities. The **Action Center** is the UI hub for this.

3. **SaaS layer** (Phase 3 — IN PROGRESS). Subscriptions (Paddle), tiered usage
   limits, agency/white-label features, onboarding, and scheduled scans.

### Who it's for

- **Direct brands** wanting to monitor and improve their AI visibility.
- **Agencies** managing GEO for multiple client brands (the AGENCY tier).

---

## 2. Tech stack (exact versions matter)

The training data of most models is **behind** these versions. Do not assume
older APIs. Verify against the installed packages.

| Layer           | Choice                             | Version                     | Notes                                                                          |
| --------------- | ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| Framework       | Next.js (App Router)               | **16.2.12**                 | NOT 15. Uses `proxy.ts` (not `middleware.ts`), async `params`, `after()`.      |
| UI runtime      | React                              | 19.2.4                      |                                                                                |
| Styling         | Tailwind CSS                       | v4                          | Uses `@theme inline` in `globals.css`, not a JS config.                        |
| Components      | shadcn/ui                          | CLI v4 (`radix-nova` style) | Components live in `src/components/ui/`.                                       |
| Charts          | recharts                           | 3.10.1                      | Colored via shadcn `--chart-1..5` OKLCH tokens.                                |
| ORM             | Prisma                             | **7.9.0**                   | v7 removed connection URLs from the schema. See §4.                            |
| Database        | PostgreSQL / Neon (serverless)     | —                           | Connected via the Neon **driver adapter**.                                     |
| Auth            | Clerk (`@clerk/nextjs`)            | **v7 / Core 3**             | `auth()`/`clerkClient()` are **async**.                                        |
| Billing         | Paddle (`@paddle/paddle-node-sdk`) | 3.8.0                       | Merchant-of-record (chosen over Stripe for Pakistan — handles global tax/VAT). |
| AI — OpenAI     | `openai`                           | 6.49.0                      | `gpt-4o`.                                                                      |
| AI — Anthropic  | `@anthropic-ai/sdk`                | 0.115.0                     | `claude-sonnet-5`.                                                             |
| AI — Google     | `@google/genai`                    | 2.13.0                      | `gemini-2.0-flash`. NOTE: this is the NEW SDK, not `@google/generative-ai`.    |
| AI — Perplexity | raw `fetch`                        | —                           | `sonar` model; `api.perplexity.ai/chat/completions`.                           |
| Search          | Serper.dev                         | raw `fetch`                 | For source mapping.                                                            |
| Validation      | zod                                | 4.4.3                       |                                                                                |
| Toasts          | sonner                             | 2.0.7                       |                                                                                |
| Icons           | lucide-react                       | 1.27.0                      |                                                                                |
| Deploy target   | Vercel                             | —                           |                                                                                |

**Node**: 24.x. **Package manager**: npm.

### AI model IDs (current — do not "correct" to older ones)

- OpenAI: `gpt-4o`
- Anthropic: `claude-sonnet-5` (via Messages API; `max_tokens` required; do NOT
  use `budget_tokens` — it's removed on current models)
- Gemini: `gemini-2.0-flash`
- Perplexity: `sonar`

For the platform's _own_ AI features (prompt generation, sentiment, gap actions,
content generation), a `FAST_MODEL`/`SMART_MODEL` split is used, switchable to
cheaper models via the `AI_MODEL_TIER=cheap` env var.

---

## 3. Repository layout

```
/
├── prisma/
│   └── schema.prisma          # data model (§4)
├── prisma.config.ts           # Prisma 7 config (connection URLs live here, not in schema)
├── src/
│   ├── proxy.ts               # Clerk auth middleware (Next 16 renamed middleware→proxy)
│   ├── app/
│   │   ├── layout.tsx         # root layout: ClerkProvider (inside <body>), Toaster, Tooltip
│   │   ├── page.tsx           # marketing landing; redirects signed-in users to /dashboard
│   │   ├── globals.css        # Tailwind v4 theme + shadcn tokens (Geist font fix applied)
│   │   ├── (auth)/            # sign-in / sign-up (Clerk catch-all routes)
│   │   ├── (dashboard)/       # protected app shell + pages (§6)
│   │   └── api/               # backend route handlers (§7)
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   ├── dashboard-sidebar.tsx, mobile-nav.tsx, page-header.tsx
│   │   ├── add-brand-dialog.tsx
│   │   ├── brand-dashboard.tsx    # flagship monitoring dashboard (client, recharts)
│   │   └── action-center.tsx      # execution hub (client)
│   ├── lib/
│   │   ├── db.ts              # Prisma singleton (Neon adapter)
│   │   ├── auth.ts            # getCurrentUser (JIT user provisioning) + requireBrandOwnership
│   │   ├── types.ts           # re-exports Prisma enums/types (see §4 gotcha)
│   │   ├── ai.ts              # shared Anthropic client + completeText + extractJson
│   │   ├── queries.ts         # getUserBrands
│   │   ├── dashboard.ts        # getBrandDashboard (view model for the flagship page)
│   │   ├── validation/brand.ts # zod schema for brand input
│   │   ├── engines/           # AI engine adapters (§5)
│   │   ├── analysis/          # parser.ts (mentions/sentiment) + scoring.ts (metrics)
│   │   ├── prompts/generator.ts # buyer-intent prompt generation
│   │   ├── scan/              # runner.ts (orchestration) + concurrency.ts + serialize.ts
│   │   └── execution/         # gap-analysis, content-generator, technical, source-mapping
│   └── generated/prisma/      # Prisma-generated client (gitignored; run `prisma generate`)
├── CLAUDE.md                  # short conventions doc (for Claude Code)
├── README.md                  # setup instructions
├── PRD.md                     # THIS FILE
└── .env.example               # all env vars documented
```

---

## 4. Data model (Prisma)

Located in `prisma/schema.prisma`. All IDs are `cuid()`. All child relations
cascade-delete from their parent.

### Enums

- `ScanStatus`: PENDING · RUNNING · DONE · FAILED
- `Engine`: OPENAI · CLAUDE · GEMINI · PERPLEXITY
- `Sentiment`: POSITIVE · NEUTRAL · NEGATIVE
- `Severity`: HIGH · MEDIUM · LOW (gap ranking)
- `Tier`: STARTER · PRO · AGENCY (billing — added in 3.1)
- `SubscriptionStatus`: ACTIVE · TRIALING · PAST_DUE · CANCELED (billing — 3.1)

### Models

- **User** — mirrors the Clerk user. `clerkId` (unique) is identity; a local row
  exists so brands/subscription can FK to a stable id. JIT-created on first
  authenticated request (see `lib/auth.ts`).
- **Subscription** — 1:1 with User. `tier`, `status`, Paddle ids,
  `currentPeriodEnd`. Absent = free STARTER defaults. (Added in 3.1; billing
  logic not yet wired.)
- **Brand** — name, domain, industry, description, `userId`. Has competitors,
  prompts, scanRuns, visibilityScores, gaps.
- **Competitor** — name, optional domain, `brandId`.
- **Prompt** — buyer-intent query text + category (discovery / comparison /
  evaluation / recommendation), `brandId`.
- **ScanRun** — one execution of all prompts × all engines. status, startedAt,
  completedAt, `brandId`. Has results and visibilityScores.
- **Result** — one engine's response to one prompt: engine, responseText,
  brandMentioned, position, sentiment, `citedSources String[]`. Indexed on
  scanRunId, promptId, and (scanRunId, engine).
- **VisibilityScore** — aggregated per-engine metrics for one scan: score
  (% mentioned), shareOfVoice, citationRate. `@@unique([scanRunId, engine])`
  so the runner can upsert.
- **Gap** — a prompt where the brand is absent but competitors win:
  promptText, category, competitorsWinning[], citedSources[], severity,
  recommendedAction, `addressed` (bool for the Action Center), `brandId`.

### ⚠️ Prisma 7 critical facts (read before touching DB code)

1. **No connection URLs in the schema.** `datasource db` declares only
   `provider = "postgresql"`. URLs live in `prisma.config.ts` (for Migrate) and
   the runtime client uses a **driver adapter** (`@prisma/adapter-neon`) in
   `src/lib/db.ts`.
2. **Generator is `prisma-client`** (not `prisma-client-js`), output to
   `src/generated/prisma/` — import from `@/generated/prisma/client` (there is
   no `index.ts`). This dir is gitignored; `postinstall`/`build` regenerate it.
3. **Neon needs two URLs**: `DATABASE_URL` (pooled, runtime) and `DIRECT_URL`
   (unpooled, migrations). `prisma.config.ts` uses `DIRECT_URL ?? DATABASE_URL`.
4. **⚠️ Client-bundle leak.** The generated client uses `node:async_hooks`.
   Importing a Prisma **enum value** (e.g. `Engine`) into any `"use client"`
   component's import graph breaks the build (Turbopack: "chunk item errored";
   webpack: "UnhandledSchemeError node:async_hooks"). Client components must
   import from `src/lib/scan/serialize.ts` (a client-safe `EngineName` string
   union), never Prisma enum values. `import type` is fine (erased at compile).

---

## 5. AI engine adapters (`src/lib/engines/`) — the core

This is the heart of the monitoring module. A unified interface lets the scan
runner loop over all engines identically.

- **`types.ts`** — `AIEngine` interface (`name`, `label`, `isConfigured`,
  `runPrompt(prompt) → EngineResponse`). `EngineResponse` = `{ text, sources,
model, latencyMs }`.
- **`retry.ts`** — `withRetry(engine, fn)`: 3 attempts, exponential backoff +
  jitter, hard **30s timeout** via `AbortController` (passed to fetch/SDK where
  supported). `ENGINE_TIMEOUT_MS = 30_000`.
- **`openai.ts`** — Chat Completions (`gpt-4o`). `sources: []` (no native
  citations).
- **`claude.ts`** — Anthropic Messages API (`claude-sonnet-5`). `sources: []`.
- **`gemini.ts`** — `@google/genai` v2 (`gemini-2.0-flash`). `sources: []`.
- **`perplexity.ts`** — Sonar HTTP API. **Captures the real `citations` /
  `search_results[].url` array into `sources`** — this is the GEO-critical
  signal (the only engine that tells us which URLs it cited).
- **`index.ts`** — exports `engines` (only the configured ones; a missing API
  key skips that engine with a warning) and `allEngines`. Each SDK's own retry
  is disabled (`maxRetries: 0`) so `withRetry` owns the policy.

**Design rule:** an engine without an API key is _skipped_, never fatal. A scan
runs with whatever engines are configured.

---

## 6. Analysis, scoring, prompts, scan orchestration

- **`analysis/parser.ts`** —
  - `detectBrandMention(text, name)`: fuzzy, case-insensitive, tolerant of
    spacing/punctuation; returns `{ mentioned, position }` (first-match char
    index).
  - `detectCompetitorMentions(text, names[])`.
  - `extractSentiment(text, name)`: quick Claude call → POSITIVE/NEUTRAL/
    NEGATIVE, defaults NEUTRAL on failure. Only called when brand is mentioned.
  - `domainCited(sources, domain)`: does any cited URL match the brand's domain.
- **`analysis/scoring.ts`** — pure/testable. `calculateVisibility(results)` →
  per-engine `{ score, shareOfVoice, citationRate }`. `overallScore()` = mean of
  per-engine scores (the headline gauge).
- **`prompts/generator.ts`** — `generatePrompts(brand)` asks Claude for 15-20
  buyer-intent prompts (zod-validated JSON, code-fence tolerant), with a
  deterministic template fallback so a scan can always run.
- **`scan/concurrency.ts`** — `mapWithConcurrency(items, limit, worker)`: ordered
  pool that turns rejections into settled results (one failed call never aborts
  the scan).
- **`scan/runner.ts`** — `runScan(brandId, scanRunId?)`: loads brand +
  competitors + prompts, fans **(prompt × engine)** out at **concurrency 5**,
  parses each response into a `Result`, upserts per-engine `VisibilityScore`s,
  drives `ScanRun` through PENDING→RUNNING→DONE/FAILED. `createPendingScanRun`
  gives the API a stable id to return before the work starts.
- **`scan/serialize.ts`** — client-safe engine metadata (`EngineName` union,
  labels, `--chart` color vars). Deliberately decoupled from Prisma (see §4.4).

---

## 7. API routes (`src/app/api/`)

All routes check auth and resource ownership. Long-running routes set
`maxDuration` and use `after()` for background work.

| Method & path                                    | Purpose                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `POST /api/brands`                               | Create brand + competitors; generate prompts in background (`after()`).                            |
| `GET /api/brands`                                | List the user's brands with latest avg score.                                                      |
| `POST /api/scan`                                 | Owns-brand check → create PENDING run → return its id → run scan in background. `maxDuration 300`. |
| `GET /api/scan/[id]`                             | Poll a scan: status + visibility scores + results (owner-gated).                                   |
| `GET /api/brands/[id]/gaps`                      | Persisted gaps; `?refresh=1` re-runs `analyzeGaps` first.                                          |
| `GET /api/brands/[id]/content` → actually `POST` | Generate a GEO content asset. Body `{ type: comparison\|faq\|listicle\|snippet, target? }`.        |
| `GET /api/brands/[id]/technical`                 | Copy-paste JSON-LD (Organization, Product) + `llms.txt`.                                           |
| `GET /api/brands/[id]/sources`                   | Third-party sources likely to influence AI answers + outreach opportunities.                       |
| `PATCH /api/gaps/[id]`                           | Toggle a gap's `addressed` flag (owner-gated via its brand).                                       |

**Auth helpers** (`lib/auth.ts`): `getCurrentUser()` (JIT-provisions the local
User from Clerk), `requireBrandOwnership(brandId)` (returns `{ok:true,userId}` or
`{ok:false,status:401|403|404}`).

---

## 8. Execution module (`src/lib/execution/`)

- **`gap-analysis.ts`** — `analyzeGaps(brandId)`: from the latest DONE scan,
  finds prompts where the brand is absent everywhere but a competitor wins on
  ≥1 engine; categorizes the winning answers' cited sources; asks Claude for a
  specific `recommendedAction` per gap (deterministic fallback); scores severity
  (high-intent category + multi-engine loss → HIGH); persists the gap set.
- **`content-generator.ts`** — four Claude-backed generators returning
  `{ title, content, format, schema? }`: `generateComparisonArticle`,
  `generateFAQ` (+ JSON-LD FAQPage schema parsed from the markdown),
  `generateListicleEntry`, `generateAnswerSnippet`. Shared fact-dense/neutral
  GEO system prompt (AI models trust neutral content, not hype).
- **`technical.ts`** — deterministic JSON-LD (`generateOrganizationSchema`,
  `generateProductSchema` = SoftwareApplication, `generateFAQSchema`),
  `generateLlmsTxt`, and `submitToIndexNow(domain, urls, key)` (pings IndexNow so
  Bing — and thus ChatGPT Search — re-crawls). `buildTechnicalAssets` bundles
  them.
- **`source-mapping.ts`** — `mapSources(brandId)`: searches the brand's
  buyer-intent queries via Serper.dev, skips brand-owned pages, cross-references
  the latest scan's Perplexity citations to flag sources that _actually_
  influence AI answers, ranks AI-influencing + high-leverage types first
  (returns `[]` gracefully without `SERPER_API_KEY`).
  `generateOutreachList(brand, sources)`: per-source `{source, type, why,
action}` + a Claude-drafted outreach email for pitch-friendly types.

---

## 9. Frontend pages (`src/app/(dashboard)/`)

Protected by `src/proxy.ts` (Clerk). Shell in `(dashboard)/layout.tsx`:
persistent sidebar (Dashboard / Brands / Actions / Settings) + mobile Sheet nav

- top bar with Clerk `UserButton`.

* **`/dashboard`** — welcome + summary cards (stubbed; onboarding lands in 3.3).
* **`/brands`** — brand cards grid + "Add Brand" dialog (empty state designed).
* **`/brands/[id]`** — **flagship monitoring dashboard** (`brand-dashboard.tsx`):
  Run/Re-run Scan button that POSTs `/api/scan` and polls `/api/scan/[id]` every
  3s; overall gauge; 4 engine cards; share-of-voice bar chart; visibility trend
  line; prompts table with per-engine mention dots (expandable to the actual AI
  response + cited source links); sentiment donut. Links to the Action Center.
* **`/brands/[id]/actions`** — **Action Center** (`action-center.tsx`): fetches
  gaps, "Re-analyze gaps" button, progress bar, per-gap cards with Generate
  content / FAQ / Get schema / View sources / Mark done, all shown in a
  copy-to-clipboard modal.
* **`/actions`**, **`/settings`** — placeholder / account info (built out later).

**Charts follow the dataviz rules:** one axis, fixed categorical color order per
engine (never cycled), legends for ≥2 series, shadcn `--chart` tokens,
theme-aware.

---

## 10. Status — what's done and what's pending

### DONE (committed on branch `build/voquarn-geo`)

- **Phase 0**: scaffold, Clerk auth, protected dashboard shell.
- **Phase 1 (Monitoring)**: schema, engine adapters, prompt generator, analysis
  & scoring, scan runner + API, brand management UI, flagship dashboard.
- **Phase 2 (Execution)**: gap analysis, content generator, technical toolkit,
  source mapping & outreach, Action Center UI.

### IN PROGRESS

- **Phase 3.1 (Subscriptions & limits — Paddle)**: **schema only** so far
  (`Subscription` model, `Tier` + `SubscriptionStatus` enums, types barrel
  updated). **Not yet built**: tier limit definitions, Paddle checkout, webhook
  handler (`/api/webhooks/paddle`), `enforceLimit()` helper + upgrade prompts,
  `/pricing` page, billing settings page.

### PENDING (not started)

- **Phase 3.2 (Agency / multi-tenant)**: workspaces/client groupings, branded
  PDF report export, shareable read-only report links, bulk scans.
- **Phase 3.3 (Onboarding & polish)**: first-run wizard (auto-suggest
  competitors, auto first scan), empty/loading/error states pass, Vercel Cron
  scheduled scans, Resend email notifications, final a11y/responsive pass.

### Known intentional deferrals

- **Database migration not yet run** — needs a live Neon `DATABASE_URL`. Run
  `npm run db:migrate` once the DB is connected. The schema is valid and the
  client generates; only the actual migration is pending.
- **Observability instrumentation** on route handlers — deferred to 3.3 polish.
- The app has been **build/type/lint verified but not run against a live DB or
  real API keys.** First real scan is untested.

---

## 11. Environment variables (`.env.example`)

Copy to `.env.local`. Minimum to _run the app_: `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. AI keys are only needed
to run scans (missing keys skip that engine).

- `DATABASE_URL`, `DIRECT_URL` — Neon (pooled + direct).
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`
  — AI engines. `ANTHROPIC_API_KEY` also powers the platform's own AI features.
- `SERPER_API_KEY` — source mapping (optional).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (+ the sign-in/up URL
  vars) — auth.
- `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`,
  `NEXT_PUBLIC_PADDLE_ENV`, `PADDLE_PRICE_STARTER|PRO|AGENCY` — billing (3.1).
- `RESEND_API_KEY` — email (3.3).
- `NEXT_PUBLIC_APP_URL`, `AI_MODEL_TIER` (`full`|`cheap`).

---

## 12. How to run / continue (for the next developer or AI)

```bash
npm install                 # also runs prisma generate (postinstall)
cp .env.example .env.local  # fill in Neon + Clerk (min); AI keys for scans

npm run db:migrate          # create tables (needs live DATABASE_URL/DIRECT_URL)
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run build` (prisma generate + next build), `npm run lint`,
`npm run format`, `npm run db:studio`.

### Working conventions (please follow)

- TypeScript strict; named exports (except Next pages/layouts).
- Every external call (AI, DB, fetch) has error handling. AI engine adapters
  retry + time out; a failing engine is skipped, not fatal.
- Every API route checks the Clerk `userId` and verifies brand ownership.
- Pure, typed functions in `lib/analysis` and `lib/execution` (unit-testable).
- zod-validate request bodies and LLM JSON output.
- **Never import a Prisma enum _value_ into a client component** (see §4.4) —
  use `lib/scan/serialize.ts`.
- After changes: `tsc --noEmit`, `eslint`, and a production `build` should all
  pass before committing. The repo commits per phase.

### If you are an AI model continuing this work

1. Read this PRD, then `CLAUDE.md`, then the specific files for your task.
2. Verify SDK APIs against the installed `node_modules` versions in §2 — your
   training is likely older.
3. The next task is **Phase 3.1**: define tier limits, wire Paddle checkout +
   the `/api/webhooks/paddle` handler (use `paddle.webhooks.unmarshal(rawBody,
secret, signature)` and switch on `EventName`), add `enforceLimit()` before
   scans / brand creation / content generation, and build `/pricing` + billing
   settings pages.

### Tier limits (target design for 3.1)

| Tier    | Brands    | Engines | Scan frequency | Content gen                         |
| ------- | --------- | ------- | -------------- | ----------------------------------- |
| STARTER | 1         | 2       | weekly         | no                                  |
| PRO     | 3         | 4       | daily          | yes                                 |
| AGENCY  | unlimited | 4       | daily          | yes + white-label, PDF, DFY exports |
