"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  saveReviewAction,
  type ReviewFormState,
} from "@/app/onboarding/review/[brandId]/actions";
import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import { TagList } from "@/components/tag-list";
import type { ApiAccepted, ApiFailure } from "@/lib/api/types";
import type { BrandDto } from "@/lib/brands/types";
import type { PromptDto } from "@/lib/prompts/types";

const initialState: ReviewFormState = {};

export function CompetitorReview({
  brand,
  prompts,
  sourceCount,
  initialExpansionOperationId,
  initialPromptOperationId,
  initialPromptError,
}: {
  brand: BrandDto;
  prompts: PromptDto[];
  sourceCount: number | null;
  initialExpansionOperationId: string | null;
  initialPromptOperationId: string | null;
  initialPromptError: string | null;
}) {
  const directCompetitors = brand.competitors
    .filter((competitor) => competitor.tier === "TOP" || !competitor.tier)
    .slice(0, 30);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveReviewAction,
    initialState,
  );
  const [expansionOperationId, setExpansionOperationId] = useState(
    initialExpansionOperationId,
  );
  useOperationPolling(expansionOperationId, () => {
    setExpansionOperationId(null);
    router.refresh();
  });
  const [promptOperationId, setPromptOperationId] = useState(
    initialPromptOperationId,
  );
  const [promptError, setPromptError] = useState<string | null>(
    initialPromptError,
  );
  const { operation: promptOperation, pollError: promptPollError } =
    useOperationPolling(promptOperationId, (settled) => {
      setPromptOperationId(null);
      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setPromptError(
          settled.errorMessage ?? "Prompt generation did not complete.",
        );
        return;
      }
      router.refresh();
    });

  async function retryPromptGeneration() {
    setPromptError(null);
    try {
      const response = await fetch(`/api/brands/${brand.id}/prompts/generate`, {
        method: "POST",
      });
      const payload = (await response.json()) as ApiAccepted | ApiFailure;
      if (response.status === 202 && "operationId" in payload) {
        setPromptOperationId(payload.operationId);
      } else if ("error" in payload) {
        setPromptError(payload.error.message);
      }
    } catch {
      setPromptError("We could not reach the server. Try again.");
    }
  }

  return (
    <form action={formAction} className="brand-form" noValidate>
      <input type="hidden" name="brandId" value={brand.id} />
      {brand.competitors.map((competitor) => (
        <input
          key={competitor.id}
          type="hidden"
          name="allCompetitorIds"
          value={competitor.id}
        />
      ))}
      {directCompetitors.map((competitor) => (
        <input
          key={competitor.id}
          type="hidden"
          name="acceptedCompetitorIds"
          value={competitor.id}
        />
      ))}

      {state.error ? (
        <div className="form-alert" role="alert">
          {state.error}
        </div>
      ) : null}

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">1</span>
          <div>
            <h2>Your profile</h2>
            <p>Edit anything the research got wrong before you continue.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field field-span">
            <span>What the product does</span>
            <textarea
              name="description"
              defaultValue={brand.description}
              aria-invalid={Boolean(state.fieldErrors?.description)}
              disabled={pending}
            />
            {state.fieldErrors?.description ? (
              <small className="field-error">
                {state.fieldErrors.description}
              </small>
            ) : null}
          </label>
          <label className="field field-span">
            <span>Specific category</span>
            <input
              name="category"
              defaultValue={brand.category}
              aria-invalid={Boolean(state.fieldErrors?.category)}
              disabled={pending}
            />
            {state.fieldErrors?.category ? (
              <small className="field-error">
                {state.fieldErrors.category}
              </small>
            ) : null}
          </label>
        </div>
        <TagList
          groups={[
            { label: "Products & services", items: brand.services },
            { label: "Target audiences", items: brand.audiences },
            { label: "Buyer pain points", items: brand.painPoints },
            { label: "Blog & resource themes", items: brand.contentThemes },
            { label: "Differentiators", items: brand.differentiators },
          ]}
        />
        <p className="research-page-count">
          Profile grounded in {brand.discoveryPageCount} website page
          {brand.discoveryPageCount === 1 ? "" : "s"}
          {sourceCount != null ? ` and ${sourceCount} web sources` : ""} from
          OpenAI web research.
        </p>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Prompts to track</h2>
            <p>
              Real questions buyers ask AI while discovering, comparing, and
              selecting products in your market.
            </p>
          </div>
        </div>

        {promptError || promptPollError ? (
          <div className="form-alert" role="alert">
            <span>{promptError ?? promptPollError}</span>
            <button
              className="button button-secondary compact-button"
              type="button"
              onClick={() => void retryPromptGeneration()}
            >
              Generate again
            </button>
          </div>
        ) : null}

        {promptOperationId ? (
          <OperationProgress
            operation={promptOperation}
            label="Generating your prompt library…"
          />
        ) : prompts.length > 0 ? (
          <>
            <div className="prompt-review-summary">
              <span>
                <strong>{prompts.length}</strong> prompts ready
              </span>
              <span>OpenAI Search</span>
              <span>US · English</span>
            </div>
            <ol className="onboarding-prompt-list peec-prompt-list">
              {prompts.map((prompt, index) => (
                <li key={prompt.id}>
                  <span className="prompt-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{prompt.text}</p>
                  <span className="prompt-type-badge">
                    {prompt.type.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="benchmark-empty-state">
            <span className="research-spinner" />
            <div>
              <strong>Preparing buyer prompts…</strong>
              <p>Your prompt library will appear here automatically.</p>
            </div>
          </div>
        )}

        {expansionOperationId ? (
          <span className="sr-only" role="status" aria-live="polite">
            Preparing benchmark entities…
          </span>
        ) : null}
      </section>

      <div className="form-actions">
        <p>
          Competitors stay hidden until Step 3, where benchmark evidence ranks
          the top 30.
        </p>
        <button
          className="button button-primary button-large"
          type="submit"
          disabled={
            pending ||
            Boolean(expansionOperationId) ||
            Boolean(promptOperationId) ||
            prompts.length === 0
          }
        >
          {pending
            ? "Starting benchmark…"
            : expansionOperationId || promptOperationId
              ? "Preparing analysis…"
              : "Continue to AI benchmark"}
        </button>
      </div>
    </form>
  );
}
