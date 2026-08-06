"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import type { ApiAccepted, ApiFailure } from "@/lib/api/types";

export function RunContentDraftButton({
  contentItemId,
  label = "Write draft",
}: {
  contentItemId: string;
  label?: string;
}) {
  const router = useRouter();
  const [operationId, setOperationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { operation, pollError } = useOperationPolling(
    operationId,
    (settled) => {
      setOperationId(null);

      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setError(
          settled.errorMessage ?? "Drafting did not complete. Try again.",
        );
        return;
      }

      router.refresh();
    },
  );

  async function start() {
    setError(null);
    try {
      const response = await fetch(`/api/content/${contentItemId}/draft`, {
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
        <Sparkles size={16} />
        {running ? "Writing…" : label}
      </button>
      {running ? (
        <OperationProgress
          operation={operation}
          label="Generating section by section…"
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
