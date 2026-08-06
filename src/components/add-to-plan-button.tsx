"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddToPlanButton({
  brandId,
  opportunityId,
}: {
  brandId: string;
  opportunityId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      if (response.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="button button-secondary compact-button"
      type="button"
      onClick={() => void add()}
      disabled={busy || done}
    >
      <CalendarPlus size={14} />
      {done
        ? "On this week's plan"
        : busy
          ? "Adding…"
          : "Add to this week's plan"}
    </button>
  );
}
