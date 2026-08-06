"use client";

import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import type { ApiAccepted, ApiFailure, ApiSuccess } from "@/lib/api/types";
import type { PromptDto } from "@/lib/prompts/types";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<PromptDto["type"], string> = {
  CATEGORY: "Category",
  COMPARISON: "Comparison",
  USE_CASE: "Use case",
  BRAND_SPECIFIC: "Brand-specific",
};

const TYPE_ORDER: PromptDto["type"][] = [
  "CATEGORY",
  "COMPARISON",
  "USE_CASE",
  "BRAND_SPECIFIC",
];

async function parseJson<T>(response: Response): Promise<T | ApiFailure> {
  return (await response.json()) as T | ApiFailure;
}

export function PromptTable({ brandId }: { brandId: string }) {
  const [prompts, setPrompts] = useState<PromptDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<PromptDto["type"]>("CATEGORY");
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refetch() {
    const response = await fetch(`/api/brands/${brandId}/prompts`);
    const payload = await parseJson<ApiSuccess<PromptDto[]>>(response);
    if ("data" in payload) {
      setPrompts(payload.data);
      setError(null);
    } else {
      setError(payload.error.message);
    }
  }

  useEffect(() => {
    function load() {
      void refetch();
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const { operation, pollError } = useOperationPolling(
    operationId,
    (settled) => {
      setOperationId(null);
      if (settled.status !== "FAILED" && settled.status !== "CANCELLED") {
        void refetch();
      }
    },
  );

  async function generateMore() {
    setError(null);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/generate`, {
        method: "POST",
      });
      const payload = await parseJson<ApiAccepted>(response);
      if (response.status === 202 && "operationId" in payload) {
        setOperationId(payload.operationId);
      } else if ("error" in payload) {
        setError(payload.error.message);
      }
    } catch {
      setError("We could not reach the server. Check your connection.");
    }
  }

  async function addPrompt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);

    const response = await fetch(`/api/brands/${brandId}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText, type: newType }),
    });
    const payload = await parseJson<ApiSuccess<PromptDto>>(response);

    if ("data" in payload) {
      setPrompts((current) => [...(current ?? []), payload.data]);
      setNewText("");
    } else {
      setAddError(payload.error.message);
    }
  }

  async function toggleActive(prompt: PromptDto) {
    setBusyId(prompt.id);
    const response = await fetch(`/api/prompts/${prompt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !prompt.isActive }),
    });
    const payload = await parseJson<ApiSuccess<PromptDto>>(response);
    if ("data" in payload) {
      setPrompts((current) =>
        (current ?? []).map((item) =>
          item.id === prompt.id ? payload.data : item,
        ),
      );
    }
    setBusyId(null);
  }

  function startEdit(prompt: PromptDto) {
    setEditingId(prompt.id);
    setEditingText(prompt.text);
  }

  async function saveEdit(promptId: string) {
    setBusyId(promptId);
    const response = await fetch(`/api/prompts/${promptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editingText }),
    });
    const payload = await parseJson<ApiSuccess<PromptDto>>(response);
    if ("data" in payload) {
      setPrompts((current) =>
        (current ?? []).map((item) =>
          item.id === promptId ? payload.data : item,
        ),
      );
      setEditingId(null);
    }
    setBusyId(null);
  }

  async function removePrompt(promptId: string) {
    setBusyId(promptId);
    const response = await fetch(`/api/prompts/${promptId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setPrompts((current) =>
        (current ?? []).filter((item) => item.id !== promptId),
      );
    }
    setBusyId(null);
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: (prompts ?? []).filter((prompt) => prompt.type === type),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="prompt-table">
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

      <div className="prompt-table-actions">
        <p>
          {prompts
            ? `${prompts.length} prompt${prompts.length === 1 ? "" : "s"}, ${
                prompts.filter((p) => p.isActive).length
              } active`
            : "Loading…"}
        </p>
        <button
          className="button button-secondary compact-button"
          type="button"
          onClick={() => void generateMore()}
          disabled={operationId !== null}
        >
          {operationId !== null ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <Sparkles size={14} />
          )}
          Generate more
        </button>
      </div>

      {operationId !== null ? (
        <OperationProgress operation={operation} label="Generating prompts…" />
      ) : null}

      {prompts === null ? null : prompts.length === 0 ? (
        <p className="muted-text">
          No prompts yet. Generate a set automatically or add your own below.
        </p>
      ) : (
        grouped.map((group) => (
          <section className="prompt-group" key={group.type}>
            <h3>{TYPE_LABELS[group.type]}</h3>
            <ul>
              {group.items.map((prompt) => (
                <li
                  className={cn(
                    "prompt-row",
                    !prompt.isActive && "is-inactive",
                  )}
                  key={prompt.id}
                >
                  {editingId === prompt.id ? (
                    <>
                      <textarea
                        className="prompt-edit-input"
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                        rows={2}
                      />
                      <div className="prompt-row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => void saveEdit(prompt.id)}
                          disabled={busyId === prompt.id}
                          aria-label="Save prompt"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel edit"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="prompt-row-text">
                        <input
                          type="checkbox"
                          checked={prompt.isActive}
                          onChange={() => void toggleActive(prompt)}
                          disabled={busyId === prompt.id}
                          aria-label={
                            prompt.isActive
                              ? "Deactivate prompt"
                              : "Activate prompt"
                          }
                        />
                        <span>{prompt.text}</span>
                        {prompt.source === "AI_GENERATED" &&
                        !prompt.approvedAt ? (
                          <small className="status-pill">Needs review</small>
                        ) : null}
                      </label>
                      <div className="prompt-row-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => startEdit(prompt)}
                          aria-label="Edit prompt"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => void removePrompt(prompt.id)}
                          disabled={busyId === prompt.id}
                          aria-label="Delete prompt"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <form className="prompt-add-form" onSubmit={addPrompt}>
        <select
          value={newType}
          onChange={(event) =>
            setNewType(event.target.value as PromptDto["type"])
          }
          aria-label="Prompt type"
        >
          {TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input
          value={newText}
          onChange={(event) => setNewText(event.target.value)}
          placeholder="Add your own prompt…"
          aria-label="New prompt text"
        />
        <button
          className="button button-secondary compact-button"
          type="submit"
        >
          <Plus size={14} /> Add
        </button>
      </form>
      {addError ? <small className="field-error">{addError}</small> : null}
    </div>
  );
}
