import { randomUUID } from "node:crypto";

import type { Prisma, Operation } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import type { WorkspaceContext } from "@/lib/auth/context";
import { scopedDb } from "@/lib/db/scoped";
import { isPrismaErrorCode } from "@/lib/db/prisma-errors";
import type { OperationDto, OperationKind } from "@/lib/operations/types";

function toOperationDto(operation: Operation): OperationDto {
  return {
    id: operation.id,
    kind: operation.kind,
    status: operation.status,
    progressCurrent: operation.progressCurrent,
    progressTotal: operation.progressTotal,
    brandId: operation.brandId,
    errorCode: operation.errorCode,
    errorMessage: operation.errorMessage,
    metadata: (operation.metadata as Record<string, unknown> | null) ?? null,
    startedAt: operation.startedAt?.toISOString() ?? null,
    completedAt: operation.completedAt?.toISOString() ?? null,
    createdAt: operation.createdAt.toISOString(),
    updatedAt: operation.updatedAt.toISOString(),
  };
}

async function updateOperationOrThrow(
  ctx: WorkspaceContext,
  operationId: string,
  data: Parameters<
    ReturnType<typeof scopedDb>["operation"]["update"]
  >[0]["data"],
): Promise<OperationDto> {
  try {
    const operation = await scopedDb(ctx).operation.update({
      where: { id: operationId },
      data,
    });
    return toOperationDto(operation);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      throw new AppError(404, "OPERATION_NOT_FOUND", "Operation not found.");
    }
    throw error;
  }
}

export async function createOperation(
  ctx: WorkspaceContext,
  input: {
    kind: OperationKind;
    brandId?: string;
    progressTotal?: number;
    metadata?: Prisma.InputJsonValue;
    idempotencyKey?: string;
  },
): Promise<OperationDto> {
  const operation = await scopedDb(ctx).operation.create({
    data: {
      workspaceId: ctx.workspaceId,
      kind: input.kind,
      brandId: input.brandId ?? null,
      progressTotal: input.progressTotal ?? 0,
      metadata: input.metadata,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    },
  });

  return toOperationDto(operation);
}

export async function getOperation(
  ctx: WorkspaceContext,
  operationId: string,
): Promise<OperationDto | null> {
  const operation = await scopedDb(ctx).operation.findUnique({
    where: { id: operationId },
  });

  return operation ? toOperationDto(operation) : null;
}

/** Lets a page start polling an operation that was kicked off by another function (e.g. the review page picking up the COMPETITOR_EXPANSION operation that brandDiscovery auto-fires) without needing the id passed through an event response. */
export async function getLatestOperationForBrand(
  ctx: WorkspaceContext,
  brandId: string,
  kind: OperationKind,
): Promise<OperationDto | null> {
  const operation = await scopedDb(ctx).operation.findFirst({
    where: { brandId, kind },
    orderBy: { createdAt: "desc" },
  });

  return operation ? toOperationDto(operation) : null;
}

export async function startOperation(
  ctx: WorkspaceContext,
  operationId: string,
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, {
    status: "RUNNING",
    startedAt: new Date(),
  });
}

export async function advanceOperation(
  ctx: WorkspaceContext,
  operationId: string,
  input: {
    progressCurrent?: number;
    progressTotal?: number;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, {
    progressCurrent: input.progressCurrent,
    progressTotal: input.progressTotal,
    metadata: input.metadata,
  });
}

export async function setOperationBrand(
  ctx: WorkspaceContext,
  operationId: string,
  brandId: string,
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, { brandId });
}

export async function attachInngestRun(
  ctx: WorkspaceContext,
  operationId: string,
  inngestRunId: string,
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, { inngestRunId });
}

export async function completeOperation(
  ctx: WorkspaceContext,
  operationId: string,
  input: { metadata?: Prisma.InputJsonValue } = {},
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, {
    status: "COMPLETED",
    completedAt: new Date(),
    progressCurrent: undefined,
    metadata: input.metadata,
  });
}

export async function partialOperation(
  ctx: WorkspaceContext,
  operationId: string,
  input: {
    errorCode?: string;
    errorMessage?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, {
    status: "PARTIAL",
    completedAt: new Date(),
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    metadata: input.metadata,
  });
}

export async function failOperation(
  ctx: WorkspaceContext,
  operationId: string,
  input: { errorCode: string; errorMessage: string },
): Promise<OperationDto> {
  return updateOperationOrThrow(ctx, operationId, {
    status: "FAILED",
    completedAt: new Date(),
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
  });
}

/**
 * Stops future work by marking the operation CANCELLED. It never deletes
 * evidence already collected — callers must not roll back partial writes.
 * A no-op (still succeeds) if the operation has already reached a terminal
 * state, since a cancel racing a completion is expected, not an error.
 */
export async function cancelOperation(
  ctx: WorkspaceContext,
  operationId: string,
): Promise<OperationDto> {
  const existing = await getOperation(ctx, operationId);
  if (!existing) {
    throw new AppError(404, "OPERATION_NOT_FOUND", "Operation not found.");
  }

  const terminal: ReadonlyArray<OperationDto["status"]> = [
    "COMPLETED",
    "PARTIAL",
    "FAILED",
    "CANCELLED",
  ];
  if (terminal.includes(existing.status)) {
    return existing;
  }

  return updateOperationOrThrow(ctx, operationId, {
    status: "CANCELLED",
    completedAt: new Date(),
  });
}
