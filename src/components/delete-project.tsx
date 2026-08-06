"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFailure, ApiSuccess } from "@/lib/api/types";

type DeleteResult = { deletedId: string; nextBrandId: string | null };

export function DeleteProject({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json()) as
        ApiSuccess<DeleteResult> | ApiFailure;
      if (!response.ok || !("data" in payload)) {
        setError(
          "error" in payload
            ? payload.error.message
            : "Could not delete this project.",
        );
        setDeleting(false);
        return;
      }

      if (payload.data.nextBrandId) {
        router.push(`/projects/${payload.data.nextBrandId}/overview`);
      } else {
        router.push("/onboarding");
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        className="button button-danger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} /> Delete project
      </button>
      {open ? (
        <div className="modal-layer" role="presentation">
          <button
            className="modal-backdrop"
            onClick={() => setOpen(false)}
            aria-label="Close dialog"
          />
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <button
              className="icon-button modal-close"
              onClick={() => setOpen(false)}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
            <div className="danger-icon">
              <AlertTriangle size={21} />
            </div>
            <h2 id="delete-title">Delete {brandName}?</h2>
            <p>
              This permanently removes the brand, competitors, future prompts,
              runs, analyses, and sources.
            </p>
            <label className="field">
              <span>
                Type <strong>{brandName}</strong> to confirm
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoFocus
              />
            </label>
            {error ? (
              <div className="form-alert" role="alert">
                {error}
              </div>
            ) : null}
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="button button-danger"
                onClick={remove}
                disabled={confirmation !== brandName || deleting}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
