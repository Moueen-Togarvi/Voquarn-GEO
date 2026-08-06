#!/usr/bin/env node
/**
 * Fails when prisma/schema.prisma and prisma/migrations have diverged — i.e.
 * someone edited the schema without generating a migration.
 *
 * `--from-migrations` replays every migration into a scratch database that
 * Prisma creates on whatever server the datasource points at. That is
 * destructive, so this script refuses to run against the configured
 * DATABASE_URL and instead overrides the datasource with SHADOW_DATABASE_URL
 * for the child process only. No SHADOW_DATABASE_URL, no check.
 */
import { spawnSync } from "node:child_process";

const shadowUrl = process.env.SHADOW_DATABASE_URL;

if (!shadowUrl) {
  console.log(
    "SHADOW_DATABASE_URL is not set — skipping the migration drift check.",
  );
  process.exit(0);
}

const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "./prisma/migrations",
    "--to-schema",
    "./prisma/schema.prisma",
    "--exit-code",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // prisma.config.ts resolves the datasource from DIRECT_URL ?? DATABASE_URL.
      DATABASE_URL: shadowUrl,
      DIRECT_URL: shadowUrl,
    },
  },
);

// `--exit-code` reports 0 for "in sync", 2 for "differences found", 1 for error.
if (result.status === 2) {
  console.error(
    "\nschema.prisma has drifted from prisma/migrations.\n" +
      "Run `npm run db:migrate` to generate the missing migration.",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
