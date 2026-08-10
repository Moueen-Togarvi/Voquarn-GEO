"use client";

import { useEffect, useRef, useState } from "react";

import type { ApiFailure, ApiSuccess } from "@/lib/api/types";
import type { OperationDto } from "@/lib/operations/types";

const POLL_INTERVAL_MS = 1500;
export const OPERATION_START_TIMEOUT_MS = 45_000;
const TERMINAL_STATUSES: OperationDto["status"][] = [
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
];

export function hasOperationStartTimedOut(
  operation: OperationDto,
  now = Date.now(),
): boolean {
  const createdAt = Date.parse(operation.createdAt);
  return (
    operation.status === "PENDING" &&
    Number.isFinite(createdAt) &&
    now - createdAt >= OPERATION_START_TIMEOUT_MS
  );
}

/**
 * Polls GET /api/operations/[id] until it reaches a terminal status, then
 * calls onSettled once. Replaces the old rotating "researching…" ticker,
 * which was fiction — it never reflected real progress because discovery
 * used to run synchronously inside the request with nothing to poll.
 */
export function useOperationPolling(
  operationId: string | null,
  onSettled: (operation: OperationDto) => void,
) {
  const [operation, setOperation] = useState<OperationDto | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const onSettledRef = useRef(onSettled);

  // Refs are only mutated outside of render — here, after every commit —
  // never synchronously in the render body itself.
  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    if (!operationId) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    async function poll() {
      setPollError(null);

      try {
        const response = await fetch(`/api/operations/${operationId}`);
        const payload = (await response.json()) as
          ApiSuccess<OperationDto> | ApiFailure;

        if (cancelled) return;

        if (!response.ok || !("data" in payload)) {
          setPollError(
            "error" in payload
              ? payload.error.message
              : "Could not check progress.",
          );
          return;
        }

        setOperation(payload.data);

        if (TERMINAL_STATUSES.includes(payload.data.status)) {
          onSettledRef.current(payload.data);
          return;
        }

        if (hasOperationStartTimedOut(payload.data)) {
          const timedOut: OperationDto = {
            ...payload.data,
            status: "FAILED",
            errorCode: "WORKER_NOT_STARTED",
            errorMessage:
              "The background worker did not start. Restart npm run dev, wait for the Inngest server to be ready, then submit again.",
            completedAt: new Date().toISOString(),
          };
          setOperation(timedOut);
          onSettledRef.current(timedOut);
          return;
        }

        timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) {
          setPollError("We could not reach the server. Check your connection.");
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [operationId]);

  return { operation, pollError };
}

export function OperationProgress({
  operation,
  label,
  unitLabel = "steps completed",
}: {
  operation: OperationDto | null;
  label: string;
  unitLabel?: string;
}) {
  if (!operation) return null;

  const percent =
    operation.progressTotal > 0
      ? Math.min(
          100,
          Math.round(
            (operation.progressCurrent / operation.progressTotal) * 100,
          ),
        )
      : 0;

  return (
    <div className="research-progress" role="status" aria-live="polite">
      <span className="research-spinner" />
      <div>
        <strong>{label}</strong>
        <small>
          {operation.progressTotal > 0
            ? `${operation.progressCurrent} of ${operation.progressTotal} ${unitLabel}`
            : "This can take around 20–60 seconds."}
        </small>
        {operation.progressTotal > 0 ? (
          <span className="research-progress-track" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
