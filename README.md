# Voquarn GEO

Phase 1 foundation for a Generative Engine Optimization platform. The current
milestone provides multi-project SaaS brand onboarding and prepares the data,
job, and LLM contracts required for AI visibility measurement.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 · Neon
PostgreSQL · Inngest · OpenAI Responses API

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` to a pooled Neon connection and `DIRECT_URL` to its direct
connection. Set `OPENAI_API_KEY` for automatic multi-page website analysis,
competitor web search, and niche-specific AEO/GEO prompt generation. Inngest
keys remain optional until durable analysis jobs are enabled. Set
`SCRAPEDO_API_TOKEN` to enable localized Google SERP hunts and ranking-based
competitor evidence.

### 3. Apply the schema

```bash
npm run db:migrate
```

### 4. Run

```bash
npm run dev
```

This starts Next.js on http://localhost:3000 and the local Inngest worker/UI on
http://localhost:8288. The first run downloads the official Inngest CLI through
`npx`; background research will not complete if that process is stopped. A
fresh database routes directly to brand onboarding.

## Scripts

| Script               | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start the development server                  |
| `npm run build`      | Generate Prisma Client and build production   |
| `npm run typecheck`  | Check strict TypeScript                       |
| `npm run lint`       | Run ESLint                                    |
| `npm test`           | Run unit and conditional integration tests    |
| `npm run test:e2e`   | Run Playwright onboarding/CRUD acceptance     |
| `npm run db:migrate` | Create/apply a development database migration |
| `npm run db:deploy`  | Apply committed migrations in deployment      |

## Current scope

- Create, switch, re-analyze, and delete tracked brand projects.
- Ask the user for only a company name and official website URL.
- Analyze representative service, solution, and blog/resource pages before
  researching the niche and 2–4 direct competitors with OpenAI web search.
- Persist services, audiences, pain points, content themes, and differentiators
  so AEO/GEO monitoring prompts stay grounded in the client's actual business.
- Validate and normalize every AI-discovered field before persistence.
- Navigate Peec-inspired Overview, Prompts, Sources, Models, and Settings views.
- Keep analytics views as explicit empty states until prompt execution ships.
- Use OpenAI Structured Outputs for validated research and prompt generation,
  while retaining provider-neutral internal contracts and call accounting.
- Use Scrape.do's structured Google Search API for country/language/device-
  specific SERP snapshots, AI Overview citations, and competitor evidence.

The no-auth deployment is intended for a protected Vercel preview. Do not
expose the shared workspace publicly before application authentication exists.
