"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ApiFailure, ApiSuccess, BrandDto } from "@/lib/brands/types";
import { brandInputSchema } from "@/lib/validation/brand";

type FormCompetitor = { name: string; websiteUrl: string };
type FormValue = {
  name: string;
  websiteUrl: string;
  description: string;
  category: string;
  competitors: FormCompetitor[];
};

const emptyCompetitor = (): FormCompetitor => ({ name: "", websiteUrl: "" });

function initialFormValue(brand?: BrandDto): FormValue {
  return brand
    ? {
        name: brand.name,
        websiteUrl: brand.websiteUrl,
        description: brand.description,
        category: brand.category,
        competitors: brand.competitors.map(({ name, websiteUrl }) => ({
          name,
          websiteUrl,
        })),
      }
    : {
        name: "",
        websiteUrl: "",
        description: "",
        category: "",
        competitors: [emptyCompetitor(), emptyCompetitor()],
      };
}

export function BrandForm({ brand }: { brand?: BrandDto }) {
  const router = useRouter();
  const [value, setValue] = useState<FormValue>(() => initialFormValue(brand));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const isEditing = Boolean(brand);

  const descriptionCount = useMemo(
    () => value.description.length,
    [value.description],
  );

  function updateField(
    field: keyof Omit<FormValue, "competitors">,
    fieldValue: string,
  ) {
    setValue((current) => ({ ...current, [field]: fieldValue }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function updateCompetitor(
    index: number,
    field: keyof FormCompetitor,
    fieldValue: string,
  ) {
    setValue((current) => ({
      ...current,
      competitors: current.competitors.map((competitor, competitorIndex) =>
        competitorIndex === index
          ? { ...competitor, [field]: fieldValue }
          : competitor,
      ),
    }));
    setErrors((current) => ({
      ...current,
      [`competitors.${index}.${field}`]: "",
    }));
  }

  function addCompetitor() {
    if (value.competitors.length < 4) {
      setValue((current) => ({
        ...current,
        competitors: [...current.competitors, emptyCompetitor()],
      }));
    }
  }

  function removeCompetitor(index: number) {
    if (value.competitors.length > 2) {
      setValue((current) => ({
        ...current,
        competitors: current.competitors.filter(
          (_, competitorIndex) => competitorIndex !== index,
        ),
      }));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setStatus("saving");

    const parsed = brandInputSchema.safeParse(value);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        nextErrors[key] ??= issue.message;
      }
      setErrors(nextErrors);
      setStatus("idle");
      return;
    }

    try {
      const response = await fetch(
        isEditing ? `/api/brands/${brand?.id}` : "/api/brands",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const payload = (await response.json()) as
        ApiSuccess<BrandDto> | ApiFailure;

      if (!response.ok || !("data" in payload)) {
        if ("error" in payload) {
          setServerError(payload.error.message);
          const apiErrors = Object.fromEntries(
            Object.entries(payload.error.fieldErrors ?? {}).map(
              ([key, messages]) => [key, messages?.[0] ?? ""],
            ),
          );
          setErrors((current) => ({ ...current, ...apiErrors }));
        }
        setStatus("idle");
        return;
      }

      if (isEditing) {
        setValue(initialFormValue(payload.data));
        setStatus("saved");
        router.refresh();
        window.setTimeout(() => setStatus("idle"), 2200);
      } else {
        router.push(`/projects/${payload.data.id}/overview`);
        router.refresh();
      }
    } catch {
      setServerError(
        "We could not reach the server. Check your connection and try again.",
      );
      setStatus("idle");
    }
  }

  const errorFor = (key: string) => errors[key];

  return (
    <form className="brand-form" onSubmit={submit} noValidate>
      {serverError ? (
        <div className="form-alert" role="alert">
          {serverError}
        </div>
      ) : null}

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">1</span>
          <div>
            <h2>Tell us about your product</h2>
            <p>
              Use the wording your buyers would use when describing your
              category.
            </p>
          </div>
        </div>

        <div className="form-grid two-columns">
          <label className="field">
            <span>Brand name</span>
            <input
              value={value.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Voquarn"
              aria-invalid={Boolean(errorFor("name"))}
            />
            {errorFor("name") ? (
              <small className="field-error">{errorFor("name")}</small>
            ) : null}
          </label>
          <label className="field">
            <span>Website</span>
            <input
              type="url"
              value={value.websiteUrl}
              onChange={(event) =>
                updateField("websiteUrl", event.target.value)
              }
              placeholder="https://voquarn.com"
              aria-invalid={Boolean(errorFor("websiteUrl"))}
            />
            {errorFor("websiteUrl") ? (
              <small className="field-error">{errorFor("websiteUrl")}</small>
            ) : null}
          </label>
          <label className="field field-span">
            <span>What does your product do?</span>
            <textarea
              value={value.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="An AI visibility platform for SaaS marketing teams."
              rows={3}
              maxLength={240}
              aria-invalid={Boolean(errorFor("description"))}
            />
            <span className="field-meta">
              {errorFor("description") ? (
                <small className="field-error">{errorFor("description")}</small>
              ) : (
                <small>One clear sentence works best.</small>
              )}
              <small>{descriptionCount}/240</small>
            </span>
          </label>
          <label className="field field-span">
            <span>Specific category</span>
            <input
              value={value.category}
              onChange={(event) => updateField("category", event.target.value)}
              placeholder="AI search visibility software for SaaS companies"
              aria-invalid={Boolean(errorFor("category"))}
            />
            {errorFor("category") ? (
              <small className="field-error">{errorFor("category")}</small>
            ) : (
              <small>
                Be specific—not “software,” but “email API for developers.”
              </small>
            )}
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading form-section-heading-action">
          <div className="heading-with-step">
            <span className="step-number">2</span>
            <div>
              <h2>Add your closest competitors</h2>
              <p>
                We will compare how AI models mention and position each brand.
              </p>
            </div>
          </div>
          <span className="count-pill">{value.competitors.length}/4</span>
        </div>

        <div className="competitor-list">
          {value.competitors.map((competitor, index) => (
            <div className="competitor-row" key={index}>
              <span className="competitor-index">{index + 1}</span>
              <label className="field">
                <span className="sr-only">Competitor {index + 1} name</span>
                <input
                  value={competitor.name}
                  onChange={(event) =>
                    updateCompetitor(index, "name", event.target.value)
                  }
                  placeholder="Competitor name"
                  aria-invalid={Boolean(errorFor(`competitors.${index}.name`))}
                />
                {errorFor(`competitors.${index}.name`) ? (
                  <small className="field-error">
                    {errorFor(`competitors.${index}.name`)}
                  </small>
                ) : null}
              </label>
              <label className="field">
                <span className="sr-only">Competitor {index + 1} website</span>
                <input
                  type="url"
                  value={competitor.websiteUrl}
                  onChange={(event) =>
                    updateCompetitor(index, "websiteUrl", event.target.value)
                  }
                  placeholder="https://competitor.com"
                  aria-invalid={Boolean(
                    errorFor(`competitors.${index}.websiteUrl`),
                  )}
                />
                {errorFor(`competitors.${index}.websiteUrl`) ? (
                  <small className="field-error">
                    {errorFor(`competitors.${index}.websiteUrl`)}
                  </small>
                ) : null}
              </label>
              <button
                className="icon-button danger-hover"
                type="button"
                onClick={() => removeCompetitor(index)}
                disabled={value.competitors.length <= 2}
                aria-label={`Remove competitor ${index + 1}`}
              >
                <Trash2 size={17} />
              </button>
              {errorFor(`competitors.${index}`) ? (
                <small className="field-error competitor-wide-error">
                  {errorFor(`competitors.${index}`)}
                </small>
              ) : null}
            </div>
          ))}
        </div>

        {value.competitors.length < 4 ? (
          <button
            className="button button-ghost add-competitor"
            type="button"
            onClick={addCompetitor}
          >
            <Plus size={16} /> Add another competitor
          </button>
        ) : null}
      </section>

      <div className="form-actions">
        <p>Your data stays inside your protected workspace.</p>
        <button
          className="button button-primary button-large"
          type="submit"
          disabled={status === "saving"}
        >
          {status === "saving"
            ? "Saving…"
            : status === "saved"
              ? "Changes saved"
              : isEditing
                ? "Save changes"
                : "Create project"}
        </button>
      </div>
    </form>
  );
}
