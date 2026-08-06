"use client";

import { Check, Clock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Decision = "ACCEPTED" | "DEFERRED" | "DISMISSED";

export function OpportunityDecisionButtons({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Decision | null>(null);

  async function decide(status: Decision) {
    setBusy(status);
    try {
      await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="opportunity-actions">
      <button
        className="button button-primary compact-button"
        type="button"
        onClick={() => void decide("ACCEPTED")}
        disabled={busy !== null}
      >
        <Check size={14} /> {busy === "ACCEPTED" ? "Accepting…" : "Accept"}
      </button>
      <button
        className="button button-secondary compact-button"
        type="button"
        onClick={() => void decide("DEFERRED")}
        disabled={busy !== null}
      >
        <Clock size={14} /> {busy === "DEFERRED" ? "Deferring…" : "Defer"}
      </button>
      <button
        className="button button-ghost compact-button"
        type="button"
        onClick={() => void decide("DISMISSED")}
        disabled={busy !== null}
      >
        <X size={14} /> {busy === "DISMISSED" ? "Dismissing…" : "Dismiss"}
      </button>
    </div>
  );
}
