import type {
  IntegrationProvider,
  IntegrationStatus,
} from "@/generated/prisma/enums";

/**
 * Deliberately excludes every EncryptedSecret field — ciphertext, iv, and
 * authTag must never appear in a DTO. See the model comment in
 * schema.prisma and src/lib/crypto/envelope.ts.
 */
export type IntegrationConnectionDto = {
  id: string;
  provider: IntegrationProvider;
  externalAccountId: string;
  scopes: string[];
  status: IntegrationStatus;
  siteId: string;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
