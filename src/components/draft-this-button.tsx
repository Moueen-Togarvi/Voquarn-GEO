"use client";

import { FileEdit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApiFailure } from "@/lib/api/types";

type CreateContentResponse = { operationId: string; contentItemId: string };

/** Creates a ContentItem for one Opportunity and immediately navigates to it — the detail page itself shows research progress via ContentGenerationStatus, so this button doesn't poll. */
export function DraftThisButton({
  brandId,
  opportunityId,
  title,
}: {
  brandId: string;
  opportunityId: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, opportunityId }),
      });
      const payload = (await response.json()) as
        CreateContentResponse | ApiFailure;

      if (response.status === 202 && "contentItemId" in payload) {
        router.push(`/projects/${brandId}/content/${payload.contentItemId}`);
        return;
      }
      if ("error" in payload) {
        setError(payload.error.message);
      }
    } catch {
      setError("We could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="button button-secondary compact-button"
        type="button"
        onClick={() => void start()}
        disabled={busy}
      >
        <FileEdit size={14} /> {busy ? "Starting…" : "Draft this"}
      </button>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
