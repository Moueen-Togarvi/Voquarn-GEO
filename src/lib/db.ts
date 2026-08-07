import { PrismaClient } from "@/generated/prisma/client";
import { createNeonHttpCompatibilityAdapter } from "@/lib/db/neon-http-compat";
import { isTransientDbError, normalizeDbError } from "@/lib/db/resilience";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and configure Neon.",
  );
}

const databaseUrl = connectionString;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TRANSIENT_RETRY_DELAYS_MS = [150, 500, 1_250] as const;

function createPrismaClient() {
  // HTTPS is the only Neon transport that works reliably on networks which
  // block PostgreSQL TCP and WebSockets. The compatibility factory also lets
  // Prisma execute upsert/nested-write query plans in HTTP mode.
  const adapter = createNeonHttpCompatibilityAdapter(databaseUrl);
  const client = new PrismaClient({ adapter });

  // A short bounded retry window covers a cold Neon compute and intermittent
  // HTTPS failures. Every final failure is normalized to a real Error rather
  // than leaking the raw ErrorEvent some transports throw.
  return client.$extends({
    name: "connection-resilience",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          for (const delayMs of [...TRANSIENT_RETRY_DELAYS_MS, null]) {
            try {
              return await query(args);
            } catch (error) {
              if (!isTransientDbError(error) || delayMs === null) {
                throw normalizeDbError(error);
              }
              await sleep(delayMs);
            }
          }

          throw new Error("Database retry loop exited unexpectedly.");
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
