"use client";

import { Check, X } from "lucide-react";
import { useActionState, useState } from "react";
import {
  saveReviewAction,
  type ReviewFormState,
} from "@/app/onboarding/review/[brandId]/actions";
import type { BrandDto } from "@/lib/brands/types";
import { cn } from "@/lib/utils";

const initialState: ReviewFormState = {};

export function CompetitorReview({ brand }: { brand: BrandDto }) {
  const [state, formAction, pending] = useActionState(
    saveReviewAction,
    initialState,
  );
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(
    () =>
      new Set(
        brand.competitors
          .filter((competitor) => competitor.status !== "IGNORED")
          .map((competitor) => competitor.id),
      ),
  );

  function toggle(id: string) {
    setAcceptedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      {[...acceptedIds].map((id) => (
        <input key={id} type="hidden" name="acceptedCompetitorIds" value={id} />
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
        <div className="research-profile-grid">
          {[
            ["Products & services", brand.services],
            ["Target audiences", brand.audiences],
            ["Buyer pain points", brand.painPoints],
            ["Blog & resource themes", brand.contentThemes],
            ["Differentiators", brand.differentiators],
          ].map(([label, items]) => (
            <div className="research-profile-group" key={label as string}>
              <span>{label as string}</span>
              {(items as string[]).length > 0 ? (
                <ul>
                  {(items as string[]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <small>No reliable evidence found.</small>
              )}
            </div>
          ))}
        </div>
        <p className="research-page-count">
          Profile grounded in {brand.discoveryPageCount} website page
          {brand.discoveryPageCount === 1 ? "" : "s"} plus OpenAI web research.
        </p>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Competitors</h2>
            <p>
              Tap a competitor to stop tracking it. You can add more later from
              project settings.
            </p>
          </div>
        </div>
        <div className="competitor-review-grid">
          {brand.competitors.map((competitor) => {
            const accepted = acceptedIds.has(competitor.id);
            return (
              <button
                type="button"
                key={competitor.id}
                className={cn("competitor-toggle", accepted && "is-accepted")}
                onClick={() => toggle(competitor.id)}
                aria-pressed={accepted}
                disabled={pending}
              >
                <span>
                  <strong>{competitor.name}</strong>
                  <small>{competitor.domain}</small>
                </span>
                <span className="status-pill">
                  {accepted ? (
                    <>
                      <Check size={12} /> Tracking
                    </>
                  ) : (
                    <>
                      <X size={12} /> Ignored
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="form-actions">
        <p>You can fine-tune everything again from project settings.</p>
        <button
          className="button button-primary button-large"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
