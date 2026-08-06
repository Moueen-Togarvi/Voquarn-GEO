"use client";

import { Check, Globe2, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  OperationProgress,
  useOperationPolling,
} from "@/components/operation-progress";
import type { ApiAccepted, ApiFailure } from "@/lib/api/types";
import type { BrandDto } from "@/lib/brands/types";
import type { OperationDto } from "@/lib/operations/types";
import { brandDiscoveryInputSchema } from "@/lib/validation/brand";

type FormValue = { name: string; websiteUrl: string };

function brandIdFromOperation(operation: OperationDto): string | null {
  const brandId = operation.metadata?.brandId;
  return typeof brandId === "string" ? brandId : null;
}

export function BrandForm({ brand }: { brand?: BrandDto }) {
  const router = useRouter();
  const [value, setValue] = useState<FormValue>({
    name: brand?.name ?? "",
    websiteUrl: brand?.websiteUrl ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "researching" | "saved">(
    "idle",
  );
  const [operationId, setOperationId] = useState<string | null>(null);
  const isEditing = Boolean(brand);

  const { operation, pollError } = useOperationPolling(
    operationId,
    (settled) => {
      setOperationId(null);

      if (settled.status === "FAILED" || settled.status === "CANCELLED") {
        setServerError(
          settled.errorMessage ??
            "Research did not complete. Check the name and URL, then try again.",
        );
        setStatus("idle");
        return;
      }

      if (isEditing) {
        setStatus("saved");
        router.refresh();
        window.setTimeout(() => setStatus("idle"), 2200);
        return;
      }

      const brandId = brandIdFromOperation(settled);
      if (brandId) {
        // Not the project yet — the project is still a DRAFT until the
        // onboarding wizard's review and market steps finish.
        router.push(`/onboarding/review/${brandId}`);
        router.refresh();
      } else {
        setServerError(
          "Research finished, but the project could not be found.",
        );
        setStatus("idle");
      }
    },
  );

  function updateField(field: keyof FormValue, fieldValue: string) {
    setValue((current) => ({ ...current, [field]: fieldValue }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);

    const parsed = brandDiscoveryInputSchema.safeParse(value);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrors[issue.path.join(".")] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setStatus("researching");
    try {
      const response = await fetch(
        isEditing ? `/api/brands/${brand?.id}` : "/api/brands",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const payload = (await response.json()) as ApiAccepted | ApiFailure;

      if (response.status !== 202 || !("operationId" in payload)) {
        if ("error" in payload) {
          setServerError(payload.error.message);
          setErrors((current) => ({
            ...current,
            ...Object.fromEntries(
              Object.entries(payload.error.fieldErrors ?? {}).map(
                ([key, messages]) => [key, messages?.[0] ?? ""],
              ),
            ),
          }));
        }
        setStatus("idle");
        return;
      }

      setOperationId(payload.operationId);
    } catch {
      setServerError(
        "We could not reach the server. Check your connection and try again.",
      );
      setStatus("idle");
    }
  }

  return (
    <div className="brand-research-stack">
      {brand ? (
        <section className="discovered-profile" aria-labelledby="profile-title">
          <div className="form-section-heading">
            <span className="step-number">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 id="profile-title">AI-discovered profile</h2>
              <p>
                Voquarn researched the website and verified the competitive
                context automatically.
              </p>
            </div>
          </div>
          <div className="profile-facts">
            <div>
              <span>What the product does</span>
              <strong>{brand.description}</strong>
            </div>
            <div>
              <span>Specific category</span>
              <strong>{brand.category}</strong>
            </div>
          </div>
          <div className="discovered-competitors">
            <span>Direct competitors</span>
            <div>
              {brand.competitors.map((competitor) => (
                <a
                  href={competitor.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  key={competitor.id}
                >
                  <Globe2 size={15} />
                  <span>
                    <strong>{competitor.name}</strong>
                    <small>{competitor.domain}</small>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <form className="brand-form" onSubmit={submit} noValidate>
        {serverError ? (
          <div className="form-alert" role="alert">
            {serverError}
          </div>
        ) : null}

        <section className="form-section">
          <div className="form-section-heading">
            <span className="step-number">
              {isEditing ? <Search size={16} /> : "1"}
            </span>
            <div>
              <h2>
                {isEditing ? "Re-analyze your company" : "Add your company"}
              </h2>
              <p>
                Only the company name and website are needed. AI discovers the
                product, category, and closest competitors for you.
              </p>
            </div>
          </div>

          <div className="form-grid two-columns">
            <label className="field">
              <span>Company name</span>
              <input
                value={value.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Voquarn"
                aria-invalid={Boolean(errors.name)}
                disabled={status === "researching"}
              />
              {errors.name ? (
                <small className="field-error">{errors.name}</small>
              ) : null}
            </label>
            <label className="field">
              <span>Company website</span>
              <input
                type="url"
                value={value.websiteUrl}
                onChange={(event) =>
                  updateField("websiteUrl", event.target.value)
                }
                placeholder="https://voquarn.com"
                aria-invalid={Boolean(errors.websiteUrl)}
                disabled={status === "researching"}
              />
              {errors.websiteUrl ? (
                <small className="field-error">{errors.websiteUrl}</small>
              ) : (
                <small>Use the official product homepage.</small>
              )}
            </label>
          </div>

          <div className="automatic-research-note">
            <Sparkles size={18} />
            <div>
              <strong>Everything else is automatic</strong>
              <p>
                We read the site, identify the specific category, and use web
                research to verify 2–4 direct competitors.
              </p>
            </div>
          </div>
        </section>

        {status === "researching" ? (
          <OperationProgress
            operation={operation}
            label={
              operation?.status === "RUNNING"
                ? "Researching your company…"
                : "Starting research…"
            }
          />
        ) : null}
        {pollError ? (
          <div className="form-alert" role="alert">
            {pollError}
          </div>
        ) : null}

        <div className="form-actions">
          <p>AI-generated details are validated before they are saved.</p>
          <button
            className="button button-primary button-large"
            type="submit"
            disabled={status === "researching"}
          >
            {status === "researching" ? (
              "Researching…"
            ) : status === "saved" ? (
              <>
                <Check size={16} /> Profile updated
              </>
            ) : isEditing ? (
              "Re-analyze project"
            ) : (
              "Research & create project"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
