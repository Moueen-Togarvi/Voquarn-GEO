# Voquarn GEO Platform

A SaaS for **Generative Engine Optimization** — track whether your brand is
mentioned across ChatGPT, Claude, Gemini, and Perplexity, then optimize content
so the engines cite you.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and conventions.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Prisma 7 → Postgres (Neon) · Clerk (auth) · Paddle (billing) · recharts.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in at least these to run locally:

- `DATABASE_URL` / `DIRECT_URL` — Neon Postgres (pooled + direct connection
  strings). Create a free database at https://neon.tech.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — from your Clerk
  dashboard (https://clerk.com).

The AI-engine keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`PERPLEXITY_API_KEY`) are only needed once you run scans. Engines without a key
are skipped gracefully.

### 3. Set up the database

With `DATABASE_URL` and `DIRECT_URL` pointing at your Neon database:

```bash
npm run db:migrate      # create tables from prisma/schema.prisma
npm run db:generate     # regenerate the Prisma client (also runs on install/build)
```

Useful DB scripts: `npm run db:studio` (browse data), `npm run db:push` (sync
schema without a migration, for prototyping).

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000 — sign up, then land on the dashboard.

## Scripts

| Script                | What it does                              |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Start the dev server                      |
| `npm run build`       | `prisma generate` then production build   |
| `npm run db:migrate`  | Create/apply a Prisma migration           |
| `npm run db:studio`   | Open Prisma Studio                        |
| `npm run format`      | Format with Prettier                      |
| `npm run lint`        | Run ESLint                                |

## Deploy

Deploy to Vercel; set the same env vars in the project settings. Neon and Clerk
are both available as Vercel Marketplace integrations for auto-provisioned env
vars.
