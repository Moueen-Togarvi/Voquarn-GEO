"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveReviewAction,
  type ReviewFormState,
} from "@/app/onboarding/review/[brandId]/actions";
import { CompetitorTable } from "@/components/competitor-table";
import { CompetitorTierTabs } from "@/components/competitor-tier-tabs";
import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import { TagList } from "@/components/tag-list";
import type { BrandDto } from "@/lib/brands/types";
import { groupCompetitorsByTier } from "@/lib/competitors/tiers";

const initialState: ReviewFormState = {};

export function CompetitorReview({
  brand,
  sourceCount,
  initialExpansionOperationId,
}: {
  brand: BrandDto;
  sourceCount: number | null;
  initialExpansionOperationId: string | null;
}) {
  const router = useRouter();
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

  // Competitor expansion backfills more rows into brand.competitors after
  // this component has already mounted (via router.refresh() below), so
  // acceptedIds' one-time initializer above never sees them. Newly-arrived
  // rows default to accepted, same as the ones present on first render.
  const knownIdsRef = useRef(new Set(brand.competitors.map((c) => c.id)));
  useEffect(() => {
    const arrivals = brand.competitors.filter(
      (competitor) => !knownIdsRef.current.has(competitor.id),
    );
    if (arrivals.length > 0) {
      setAcceptedIds((current) => {
        const next = new Set(current);
        for (const competitor of arrivals) {
          if (competitor.status !== "IGNORED") next.add(competitor.id);
        }
        return next;
      });
      knownIdsRef.current = new Set(brand.competitors.map((c) => c.id));
    }
  }, [brand.competitors]);

  const [expansionOperationId, setExpansionOperationId] = useState(
    initialExpansionOperationId,
  );
  const { operation: expansionOperation } = useOperationPolling(
    expansionOperationId,
    () => {
      setExpansionOperationId(null);
      router.refresh();
    },
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

  const competitorsByTier = groupCompetitorsByTier(brand.competitors);

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
            <h2>Competitors</h2>
            <p>
              Toggle a competitor&apos;s tracking status. Top, Middle, and
              Bottom tiers reflect how closely each one competes with you.
            </p>
          </div>
        </div>
        {expansionOperationId ? (
          <OperationProgress
            operation={expansionOperation}
            label="Finding more competitors…"
          />
        ) : null}
        <CompetitorTierTabs
          panels={(["TOP", "MIDDLE", "BOTTOM"] as const).map((tier) => ({
            tier,
            count: competitorsByTier[tier].length,
            content: (
              <CompetitorTable
                competitors={competitorsByTier[tier]}
                review={{ acceptedIds, onToggle: toggle, pending }}
              />
            ),
          }))}
        />
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
