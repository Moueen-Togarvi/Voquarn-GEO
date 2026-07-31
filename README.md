# Voquarn GEO

Phase 1 foundation for a Generative Engine Optimization platform. The current
milestone provides multi-project SaaS brand onboarding and prepares the data,
job, and LLM contracts required for AI visibility measurement.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 · Neon
PostgreSQL · Inngest · GLM-5.1

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
connection. `ZAI_API_KEY` and the Inngest keys are optional until the analysis
milestone is enabled.

### 3. Apply the schema

```bash
npm run db:migrate
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000. A fresh database routes directly to brand
onboarding.

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

- Create, switch, edit, and delete tracked brand projects.
- Store 2–4 validated competitors per brand.
- Navigate Peec-inspired Overview, Prompts, Sources, Models, and Settings views.
- Keep analytics views as explicit empty states until prompt execution ships.
- Prepare a typed GLM-5.1 adapter without making model calls during onboarding.

The no-auth deployment is intended for a protected Vercel preview. Do not
expose the shared workspace publicly before application authentication exists.
