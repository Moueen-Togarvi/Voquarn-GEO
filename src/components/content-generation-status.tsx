"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { ApiSuccess } from "@/lib/api/types";
import type { ContentItemDetailDto } from "@/lib/content/types";

const POLL_INTERVAL_MS = 2000;
const WORKING_STATES = new Set(["PLANNED", "RESEARCHING", "DRAFTING"]);

const LABELS: Record<string, string> = {
  PLANNED: "Queued…",
  RESEARCHING: "Researching and building the brief…",
  DRAFTING: "Writing sections…",
};

/** Polls the content item itself (not an operationId — the create-and-navigate flow lands here before any operation is known client-side) until it leaves a working state, then refreshes the page. */
export function ContentGenerationStatus({
  contentItemId,
  state,
}: {
  contentItemId: string;
  state: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!WORKING_STATES.has(state)) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/content/${contentItemId}`);
        const payload =
          (await response.json()) as ApiSuccess<ContentItemDetailDto>;
        if (cancelled) return;

        if ("data" in payload && payload.data.state !== state) {
          router.refresh();
          return;
        }
      } catch {
        // Transient — try again on the next tick.
      }
      timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
    }

    timeoutId = window.setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [contentItemId, state, router]);

  if (!WORKING_STATES.has(state)) return null;

  return (
    <div className="form-alert" role="status" aria-live="polite">
      <Loader2 size={14} className="spin" /> {LABELS[state] ?? "Working…"}
    </div>
  );
}
