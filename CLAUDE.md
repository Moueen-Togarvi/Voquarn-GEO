# Voquarn GEO Platform

A SaaS platform for **Generative Engine Optimization (GEO)** — helping brands
get seen and cited inside AI assistant answers.

## What it does

Two modules working as a closed loop (track → fix → re-track):

1. **Monitoring** — Tracks whether a brand is mentioned across the major AI
   engines (ChatGPT / OpenAI, Claude, Gemini, Perplexity). Runs realistic
   buyer-intent prompts through each engine, detects brand & competitor
   mentions, sentiment, cited sources, and computes visibility metrics
   (mention rate, share of voice, citation rate).

2. **Execution** — Turns monitoring gaps into action. Finds prompts where
   competitors win and the brand is absent, then generates GEO-optimized
   content (comparison articles, FAQs, answer snippets), technical assets
   (JSON-LD schema, llms.txt, IndexNow), and off-site source/outreach
   opportunities.

A **SaaS layer** on top provides subscriptions (Paddle), tiered limits,
agency/white-label features, onboarding, and scheduled scans.

## Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript (strict)
- **Styling**: Tailwind CSS v4 + shadcn/ui (neutral theme)
- **Charts**: recharts
- **ORM / DB**: Prisma → PostgreSQL (Neon serverless in production)
- **Auth**: Clerk (`@clerk/nextjs` v7 / Core 3 — `auth()` is async)
- **Billing**: Paddle (merchant-of-record; handles global tax/VAT)
- **AI engines**: `openai`, `@anthropic-ai/sdk`, `@google/genai`, and the
  Perplexity Sonar HTTP API
- **Search**: Serper.dev (source mapping)
- **Email**: Resend (notifications)
- **Deploy**: Vercel

## Folder structure

```
src/
  app/
    (auth)/            → sign-in / sign-up pages (Clerk)
    (dashboard)/       → main app, protected by Clerk middleware
    api/               → backend API route handlers
  lib/
    engines/           → unified AI engine adapters (one per provider)
    analysis/          → response parsing, mention detection, scoring
    prompts/           → buyer-intent prompt generation
    execution/         → gap analysis, content gen, technical GEO, sources
    scan/              → scan orchestration (runner)
    db.ts              → Prisma singleton client
  components/          → shared UI components
    ui/                → shadcn/ui primitives
prisma/
  schema.prisma        → data model
```

## Coding conventions

- **TypeScript strict** everywhere. No `any` unless unavoidable and commented.
- **Named exports** (avoid default exports except for Next.js pages/layouts,
  which require them).
- **`async`/`await`** over `.then()` chains.
- **Error handling on every external call** (AI APIs, DB, fetch). AI engine
  adapters retry with exponential backoff and time out at 30s; a failing
  engine is skipped, not fatal.
- **Auth on every API route** — check the Clerk `userId` and verify the user
  owns the resource (brand) before acting.
- **Pure, well-typed functions** in `lib/analysis` and `lib/execution` so they
  can be unit-tested in isolation.
- **Zod** for validating request bodies and external JSON (e.g. LLM output).
- Import alias `@/*` → `src/*`.

## AI model tiers

`AI_MODEL_TIER` env var switches non-critical calls (sentiment, prompt
generation) between flagship and cheap models (`gpt-4o-mini`, `gemini-flash`,
`claude-haiku`) to control cost. See `src/lib/engines/`.

## Working notes

- Clerk Core 3: `auth()`, `clerkClient()` are **async** — always `await`.
  `authMiddleware()` is removed; use `clerkMiddleware()` + `createRouteMatcher`.
- With Next 16 cache components, `<ClerkProvider>` goes **inside** `<body>`.
- Prisma needs both `DATABASE_URL` (pooled) and `DIRECT_URL` (migrations) for
  Neon.
