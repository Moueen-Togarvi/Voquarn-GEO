import type { IntegrationConnection } from "@/generated/prisma/client";
import type { IntegrationProvider } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { assertRole, type WorkspaceContext } from "@/lib/auth/context";
import { decryptSecret, encryptSecret } from "@/lib/crypto/envelope";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import type { IntegrationConnectionDto } from "@/lib/integrations/types";

/**
 * Deliberately reads only non-secret columns. src/lib/api routes must go
 * through this function (or getConnection/getConnectionForSite below) for
 * anything user-facing — never through a query that includes `secret`.
 */
function toDto(connection: IntegrationConnection): IntegrationConnectionDto {
  return {
    id: connection.id,
    provider: connection.provider,
    externalAccountId: connection.externalAccountId,
    scopes: connection.scopes,
    status: connection.status,
    siteId: connection.siteId,
    lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

export async function getConnectionForSite(
  ctx: WorkspaceContext,
  siteId: string,
  provider: IntegrationProvider,
): Promise<IntegrationConnectionDto | null> {
  const connection = await scopedDb(ctx).integrationConnection.findFirst({
    where: { siteId, provider },
  });
  return connection ? toDto(connection) : null;
}

export async function getConnection(
  ctx: WorkspaceContext,
  connectionId: string,
): Promise<IntegrationConnectionDto | null> {
  const connection = await scopedDb(ctx).integrationConnection.findFirst({
    where: { id: connectionId },
  });
  return connection ? toDto(connection) : null;
}

/**
 * Creates the connection for a (site, provider) pair, or replaces it if one
 * already exists (a user reconnecting after a token issue) — upserted on
 * the `@@unique([siteId, provider])` constraint. EDITOR role required:
 * connecting a GSC property grants read access to that site's search data.
 */
export async function createOrReplaceConnection(
  ctx: WorkspaceContext,
  input: {
    siteId: string;
    provider: IntegrationProvider;
    externalAccountId: string;
    scopes: string[];
    refreshToken: string;
  },
): Promise<IntegrationConnectionDto> {
  assertRole(ctx, "EDITOR");

  const encrypted = encryptSecret(input.refreshToken);

  const connection = await scopedDb(ctx).integrationConnection.upsert({
    where: {
      siteId_provider: { siteId: input.siteId, provider: input.provider },
    },
    update: {
      externalAccountId: input.externalAccountId,
      scopes: input.scopes,
      status: "ACTIVE",
      lastValidatedAt: new Date(),
      secret: {
        upsert: {
          update: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            keyVersion: encrypted.keyVersion,
            rotatedAt: new Date(),
          },
          create: {
            workspaceId: ctx.workspaceId,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            keyVersion: encrypted.keyVersion,
          },
        },
      },
    },
    create: {
      workspaceId: ctx.workspaceId,
      siteId: input.siteId,
      provider: input.provider,
      externalAccountId: input.externalAccountId,
      scopes: input.scopes,
      status: "ACTIVE",
      capabilities: { search_console_read: true },
      lastValidatedAt: new Date(),
      secret: {
        create: {
          workspaceId: ctx.workspaceId,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
        },
      },
    },
  });

  return toDto(connection);
}

/**
 * Internal only — the decrypted value must never be returned from a route
 * handler or wrapped in a DTO. Callers: src/lib/providers/gsc/tokens.ts,
 * during a token refresh.
 */
export async function getDecryptedRefreshToken(
  ctx: WorkspaceContext,
  connectionId: string,
): Promise<string> {
  const connection = await scopedDb(ctx).integrationConnection.findFirst({
    where: { id: connectionId },
    include: { secret: true },
  });
  if (!connection) {
    throw new AppError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration connection not found.",
    );
  }
  if (connection.status === "REVOKED") {
    throw new AppError(
      409,
      "CONNECTION_REVOKED",
      "This connection has been disconnected. Reconnect to continue.",
    );
  }
  if (!connection.secret) {
    throw new AppError(
      404,
      "INTEGRATION_NOT_FOUND",
      "No credential stored for this connection.",
    );
  }

  return decryptSecret({
    ciphertext: Buffer.from(connection.secret.ciphertext),
    iv: Buffer.from(connection.secret.iv),
    authTag: Buffer.from(connection.secret.authTag),
    keyVersion: connection.secret.keyVersion,
  });
}

/** Google rarely issues a new refresh_token on a plain access-token refresh, but when it does, the stored secret must be updated or the next refresh fails. */
export async function rotateRefreshToken(
  ctx: WorkspaceContext,
  connectionId: string,
  newRefreshToken: string,
): Promise<void> {
  const encrypted = encryptSecret(newRefreshToken);
  await scopedDb(ctx).encryptedSecret.update({
    where: { connectionId },
    data: {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      rotatedAt: new Date(),
    },
  });
}

export async function markConnectionError(
  ctx: WorkspaceContext,
  connectionId: string,
): Promise<void> {
  await scopedDb(ctx).integrationConnection.update({
    where: { id: connectionId },
    data: { status: "ERROR" },
  });
}

export async function markConnectionValidated(
  ctx: WorkspaceContext,
  connectionId: string,
): Promise<void> {
  await scopedDb(ctx).integrationConnection.update({
    where: { id: connectionId },
    data: { status: "ACTIVE", lastValidatedAt: new Date() },
  });
}

/**
 * Marks the connection REVOKED and deletes its stored secret — "revoked"
 * means we no longer hold a usable credential, not just that we've stopped
 * using one we still have. The IntegrationConnection row itself survives
 * for audit history.
 */
export async function disconnectIntegration(
  ctx: WorkspaceContext,
  connectionId: string,
): Promise<void> {
  assertRole(ctx, "EDITOR");

  const existing = await scopedDb(ctx).integrationConnection.findFirst({
    where: { id: connectionId },
    include: { secret: { select: { id: true } } },
  });
  if (!existing) {
    throw new AppError(
      404,
      "INTEGRATION_NOT_FOUND",
      "Integration connection not found.",
    );
  }

  try {
    await scopedDb(ctx).integrationConnection.update({
      where: { id: connectionId },
      data: {
        status: "REVOKED",
        secret: existing.secret ? { delete: true } : undefined,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(
        404,
        "INTEGRATION_NOT_FOUND",
        "Integration connection not found.",
      );
    }
    throw error;
  }
}
