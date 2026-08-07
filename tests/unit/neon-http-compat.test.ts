import { describe, expect, it } from "vitest";

import { createNeonHttpCompatibilityAdapter } from "@/lib/db/neon-http-compat";

describe("Neon HTTP compatibility adapter", () => {
  it("provides Prisma a transaction facade instead of rejecting HTTP mode", async () => {
    const factory = createNeonHttpCompatibilityAdapter(
      "postgresql://user:password@example.test/database",
    );
    const adapter = await factory.connect();
    const transaction = await adapter.startTransaction();

    expect(transaction.provider).toBe("postgres");
    expect(transaction.adapterName).toBe("neon-http-compat");
    expect(transaction.options).toEqual({ usePhantomQuery: false });
    expect(transaction.queryRaw).toBeTypeOf("function");
    expect(transaction.executeRaw).toBeTypeOf("function");
    await expect(transaction.commit()).resolves.toBeUndefined();
    await expect(transaction.rollback()).resolves.toBeUndefined();
  });
});
