"use client";

import { useActionState } from "react";
import {
  finalizeOnboardingAction,
  type MarketFormState,
} from "@/app/onboarding/market/[brandId]/actions";
import { KeywordImport } from "@/components/keyword-import";
import { ProjectConfigForm } from "@/components/project-config-form";

const initialState: MarketFormState = {};

export function MarketSetupForm({
  brandId,
  defaultTimezone,
}: {
  brandId: string;
  defaultTimezone: string;
}) {
  const [state, formAction, pending] = useActionState(
    finalizeOnboardingAction,
    initialState,
  );

  return (
    <form action={formAction} className="brand-form" noValidate>
      <input type="hidden" name="brandId" value={brandId} />

      {state.error ? (
        <div className="form-alert" role="alert">
          {state.error}
        </div>
      ) : null}

      <ProjectConfigForm
        defaultTimezone={defaultTimezone}
        fieldErrors={state.fieldErrors}
        pending={pending}
      />
      <KeywordImport pending={pending} />

      <div className="form-actions">
        <p>This is the last step — your project goes live right after.</p>
        <button
          className="button button-primary button-large"
          type="submit"
          disabled={pending}
        >
          {pending ? "Setting up…" : "Finish setup"}
        </button>
      </div>
    </form>
  );
}
