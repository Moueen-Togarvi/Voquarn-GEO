"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiFailure } from "@/lib/api/types";
import type { ContentItemDetailDto } from "@/lib/content/types";

const AUTOSAVE_DELAY_MS = 1500;
const READ_ONLY_STATES = new Set([
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
  "MONITORING",
]);

/** Debounces edits into a PATCH — the "small useSyncedDoc hook" called for in the implementation plan. One save in flight at a time; a save requested while one is already running is coalesced into the next debounce window rather than firing concurrent requests. */
function useSyncedDoc(onSave: (doc: JSONContent) => Promise<void>) {
  const timeoutRef = useRef<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  const scheduleSave = useCallback((doc: JSONContent) => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setSaving(true);
      onSaveRef
        .current(doc)
        .then(() => setSavedAt(new Date()))
        .finally(() => setSaving(false));
    }, AUTOSAVE_DELAY_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  return { scheduleSave, saving, savedAt };
}

export function ContentEditor({ item }: { item: ContentItemDetailDto }) {
  const router = useRouter();
  const version = item.latestVersion;
  const readOnly = READ_ONLY_STATES.has(item.state);
  const editable = Boolean(version) && !readOnly;

  const [approveOpen, setApproveOpen] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "CHANGES_REQUESTED">(
    "APPROVED",
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = useCallback(
    async (doc: JSONContent) => {
      if (!version) return;
      await fetch(`/api/content/${item.id}/versions/${version.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc }),
      });
    },
    [item.id, version],
  );

  const { scheduleSave, saving, savedAt } = useSyncedDoc(persist);

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: version?.doc ?? { type: "doc", content: [] },
      editable,
      immediatelyRender: false,
      onUpdate: ({ editor: instance }) => {
        scheduleSave(instance.getJSON());
      },
    },
    [version?.id, editable],
  );

  async function submitDecision() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/content/${item.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as ApiFailure;
        setError(payload.error.message);
        return;
      }
      setApproveOpen(false);
      setComment("");
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function startRevision() {
    if (!editor) return;
    setBusy(true);
    try {
      await fetch(`/api/content/${item.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: editor.getJSON() }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!version) {
    return <p className="muted-text">No draft yet — request one above.</p>;
  }

  return (
    <div className="content-editor-layout">
      <div className="content-editor-main">
        <div className="content-editor-toolbar">
          <span className="muted-text">
            {readOnly
              ? "Approved — read only"
              : saving
                ? "Saving…"
                : savedAt
                  ? `Saved ${savedAt.toLocaleTimeString()}`
                  : "Unsaved"}
          </span>
          {readOnly ? (
            <button
              className="button button-secondary compact-button"
              type="button"
              onClick={() => void startRevision()}
              disabled={busy}
            >
              Create new version to edit
            </button>
          ) : (
            <button
              className="button button-primary compact-button"
              type="button"
              onClick={() => setApproveOpen(true)}
            >
              Review
            </button>
          )}
        </div>
        <EditorContent editor={editor} className="content-editor-surface" />
      </div>

      <div className="content-editor-sidebar">
        <Tabs.Root defaultValue="blockers" className="content-editor-tabs-root">
          <Tabs.List
            className="content-editor-tabs"
            aria-label="Draft review panels"
          >
            <Tabs.Trigger value="blockers" className="content-editor-tab">
              Blockers ({item.blockers.length})
            </Tabs.Trigger>
            <Tabs.Trigger value="claims" className="content-editor-tab">
              Claims ({item.claims.length})
            </Tabs.Trigger>
            <Tabs.Trigger value="quality" className="content-editor-tab">
              Quality
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="blockers" className="content-editor-tab-panel">
            {item.blockers.length === 0 ? (
              <p className="muted-text">
                No blockers — this draft is approvable.
              </p>
            ) : (
              <ul className="content-blocker-list">
                {item.blockers.map((blocker, index) => (
                  <li key={`${blocker.kind}-${index}`}>
                    <span className="status-pill">{blocker.kind}</span>
                    <span>{blocker.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tabs.Content>

          <Tabs.Content value="claims" className="content-editor-tab-panel">
            {item.claims.length === 0 ? (
              <p className="muted-text">No claims extracted yet.</p>
            ) : (
              <ul className="content-claim-list">
                {item.claims.map((claim) => (
                  <li key={claim.id}>
                    <span className="status-pill">{claim.kind}</span>
                    <p>{claim.text}</p>
                    <small className="muted-text">
                      {claim.evidenceLinks.length > 0
                        ? claim.evidenceLinks.map((link) => link.url).join(", ")
                        : "No evidence linked"}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </Tabs.Content>

          <Tabs.Content value="quality" className="content-editor-tab-panel">
            {!item.qualityScore ? (
              <p className="muted-text">
                No quality score yet — advisory only, never blocks approval.
              </p>
            ) : (
              <>
                <p>
                  <strong>{Math.round(item.qualityScore.value)}</strong> / 100
                  <small className="muted-text">
                    {" "}
                    · {Math.round(item.qualityScore.confidence * 100)}%
                    confidence
                  </small>
                </p>
                <ul className="domain-summary-list">
                  {Object.entries(item.qualityScore.components).map(
                    ([id, component]) => (
                      <li key={id}>
                        <span>{id}</span>
                        <strong>
                          {component.value === null
                            ? "—"
                            : `${Math.round(component.value * 100)}%`}
                        </strong>
                      </li>
                    ),
                  )}
                </ul>
              </>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <Dialog.Root open={approveOpen} onOpenChange={setApproveOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <div className="dialog-header">
              <Dialog.Title>Review this draft</Dialog.Title>
              <Dialog.Close className="icon-button" aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>

            <fieldset className="dialog-fieldset">
              <legend>Decision</legend>
              <label className="radio-field">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === "APPROVED"}
                  onChange={() => setDecision("APPROVED")}
                />
                Approve
              </label>
              <label className="radio-field">
                <input
                  type="radio"
                  name="decision"
                  checked={decision === "CHANGES_REQUESTED"}
                  onChange={() => setDecision("CHANGES_REQUESTED")}
                />
                Request changes
              </label>
            </fieldset>

            {decision === "APPROVED" && item.blockers.length > 0 ? (
              <div className="form-alert" role="alert">
                This draft has {item.blockers.length} unresolved blocker
                {item.blockers.length === 1 ? "" : "s"} — approval will be
                refused until they are resolved.
              </div>
            ) : null}

            <label className="field field-span">
              <span>Comment (optional)</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
              />
            </label>

            {error ? (
              <div className="form-alert" role="alert">
                {error}
              </div>
            ) : null}

            <div className="dialog-actions">
              <Dialog.Close className="button button-ghost compact-button">
                Cancel
              </Dialog.Close>
              <button
                className="button button-primary compact-button"
                type="button"
                onClick={() => void submitDecision()}
                disabled={busy}
              >
                {busy ? "Submitting…" : "Submit"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
