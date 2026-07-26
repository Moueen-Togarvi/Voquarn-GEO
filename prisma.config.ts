// Prisma 7 configuration.
// Loads env from .env.local / .env via dotenv.
//
// Neon note: migrations & introspection must run over a DIRECT (unpooled)
// connection, so the CLI datasource uses DIRECT_URL when present and falls
// back to DATABASE_URL. The generated client reads DATABASE_URL at runtime
// (the pooled connection) — see src/lib/db.ts.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prefer .env.local (Next.js convention) then .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
