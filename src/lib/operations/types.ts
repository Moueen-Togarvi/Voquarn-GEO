import type { OperationKind, OperationStatus } from "@/generated/prisma/enums";

export type OperationDto = {
  id: string;
  kind: OperationKind;
  status: OperationStatus;
  progressCurrent: number;
  progressTotal: number;
  brandId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type { OperationKind, OperationStatus };
