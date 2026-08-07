import { PrismaNeonHttp } from "@prisma/adapter-neon";

/**
 * Prisma's Neon HTTP adapter rejects every operation whose query plan opens a
 * transaction. That includes ordinary Prisma upserts and nested writes, even
 * though each generated SQL statement can be sent over Neon's HTTP endpoint.
 *
 * This factory keeps those query plans usable on networks where Neon's TCP and
 * WebSocket transports are unavailable. The transaction object delegates each
 * statement to the HTTP adapter; commit/rollback are intentionally no-ops
 * because HTTP requests do not share a database session. Individual SQL
 * statements remain atomic, but a multi-statement nested write is not atomic.
 */
export function createNeonHttpCompatibilityAdapter(connectionString: string) {
  const factory = new PrismaNeonHttp(connectionString, {});

  return {
    provider: "postgres" as const,
    adapterName: "neon-http-compat" as const,

    async connect() {
      const adapter = await factory.connect();
      const queryRaw = adapter.queryRaw.bind(adapter);
      const executeRaw = adapter.executeRaw.bind(adapter);

      adapter.startTransaction = async () => ({
        provider: adapter.provider,
        adapterName: "neon-http-compat",
        options: { usePhantomQuery: false },
        queryRaw,
        executeRaw,
        commit: async () => undefined,
        rollback: async () => undefined,
      });

      return adapter;
    },
  };
}
