"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DisconnectIntegrationButton({
  connectionId,
}: {
  connectionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    await fetch(`/api/integrations/${connectionId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      className="button button-secondary compact-button"
      type="button"
      onClick={() => void disconnect()}
      disabled={busy}
    >
      {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
