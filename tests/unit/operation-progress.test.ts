import { describe, expect, it } from "vitest";

import {
  hasOperationStartTimedOut,
  OPERATION_START_TIMEOUT_MS,
} from "@/components/operation-progress";
import type { OperationDto } from "@/lib/operations/types";

function operation(overrides: Partial<OperationDto> = {}): OperationDto {
  return {
    id: "operation-1",
    kind: "BRAND_DISCOVERY",
    status: "PENDING",
    progressCurrent: 0,
    progressTotal: 4,
    brandId: null,
    errorCode: null,
    errorMessage: null,
    metadata: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-08-07T12:00:00.000Z",
    updatedAt: "2026-08-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("hasOperationStartTimedOut", () => {
  const createdAt = Date.parse("2026-08-07T12:00:00.000Z");

  it("times out a pending operation that no worker started", () => {
    expect(
      hasOperationStartTimedOut(
        operation(),
        createdAt + OPERATION_START_TIMEOUT_MS,
      ),
    ).toBe(true);
  });

  it("keeps polling before the worker-start deadline", () => {
    expect(
      hasOperationStartTimedOut(
        operation(),
        createdAt + OPERATION_START_TIMEOUT_MS - 1,
      ),
    ).toBe(false);
  });

  it("never treats running or terminal work as a start timeout", () => {
    expect(
      hasOperationStartTimedOut(
        operation({ status: "RUNNING" }),
        createdAt + OPERATION_START_TIMEOUT_MS * 2,
      ),
    ).toBe(false);
    expect(
      hasOperationStartTimedOut(
        operation({ status: "COMPLETED" }),
        createdAt + OPERATION_START_TIMEOUT_MS * 2,
      ),
    ).toBe(false);
  });
});
