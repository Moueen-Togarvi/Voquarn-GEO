"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import type { ApiAccepted, ApiFailure } from "@/lib/api/types";

export function RunBatchButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [operationId, setOperationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { operation, pollError } = useOperationPolling(
    operationId,
    (settled) => {
      setOperationId(null);

      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setError(
          settled.errorMessage ?? "The batch did not complete. Try again.",
        );
        return;
      }

      const batchId = settled.metadata?.batchId;
      if (typeof batchId === "string") {
        router.push(`/projects/${brandId}/runs/${batchId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    },
  );

  async function start() {
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repetitions: 1 }),
      });
      const payload = (await response.json()) as ApiAccepted | ApiFailure;

      if (response.status === 202 && "operationId" in payload) {
        setOperationId(payload.operationId);
      } else if ("error" in payload) {
        setError(payload.error.message);
      }
    } catch {
      setError("We could not reach the server. Check your connection.");
    }
  }

  const running = operationId !== null;

  return (
    <div className="run-batch-trigger">
      <button
        className="button button-primary"
        type="button"
        onClick={() => void start()}
        disabled={running}
      >
        <Play size={16} fill="currentColor" />
        {running ? "Running…" : "Run analysis"}
      </button>
      {running ? (
        <OperationProgress
          operation={operation}
          label="Running your prompt set…"
        />
      ) : null}
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      {pollError ? (
        <div className="form-alert" role="alert">
          {pollError}
        </div>
      ) : null}
    </div>
  );
}
