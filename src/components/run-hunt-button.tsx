"use client";

import { Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import type { ApiAccepted, ApiFailure } from "@/lib/api/types";

export function RunHuntButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [operationId, setOperationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { operation, pollError } = useOperationPolling(
    operationId,
    (settled) => {
      setOperationId(null);

      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setError(
          settled.errorMessage ?? "The hunt did not complete. Try again.",
        );
        return;
      }

      router.refresh();
    },
  );

  async function start() {
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/hunt`, {
        method: "POST",
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
        <Radar size={16} />
        {running ? "Hunting…" : "Run hunt"}
      </button>
      {running ? (
        <OperationProgress
          operation={operation}
          label="Checking search results for your tracked keywords…"
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
