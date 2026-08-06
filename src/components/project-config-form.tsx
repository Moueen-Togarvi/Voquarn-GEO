const GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No specific goal yet" },
  { value: "INCREASE_AI_VISIBILITY", label: "Increase AI visibility" },
  { value: "INCREASE_ORGANIC_TRAFFIC", label: "Increase organic traffic" },
  { value: "IMPROVE_SHARE_OF_VOICE", label: "Improve share of voice" },
  { value: "OUTRANK_COMPETITOR", label: "Outrank a specific competitor" },
  { value: "OTHER", label: "Other" },
];

export function ProjectConfigForm({
  defaultTimezone,
  fieldErrors,
  pending,
}: {
  defaultTimezone: string;
  fieldErrors?: Record<string, string>;
  pending: boolean;
}) {
  return (
    <>
      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">1</span>
          <div>
            <h2>Target market</h2>
            <p>
              This is where Voquarn will check rankings and AI answers by
              default. You can track more markets later.
            </p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label className="field">
            <span>Country</span>
            <input
              name="country"
              placeholder="US"
              maxLength={2}
              defaultValue="US"
              aria-invalid={Boolean(fieldErrors?.country)}
              disabled={pending}
            />
            {fieldErrors?.country ? (
              <small className="field-error">{fieldErrors.country}</small>
            ) : (
              <small>2-letter ISO code, e.g. US, GB, IN.</small>
            )}
          </label>
          <label className="field">
            <span>Language</span>
            <input
              name="language"
              placeholder="en"
              maxLength={10}
              defaultValue="en"
              aria-invalid={Boolean(fieldErrors?.language)}
              disabled={pending}
            />
            {fieldErrors?.language ? (
              <small className="field-error">{fieldErrors.language}</small>
            ) : (
              <small>Language code, e.g. en, es, fr.</small>
            )}
          </label>
          <label className="field">
            <span>Region (optional)</span>
            <input name="region" placeholder="California" disabled={pending} />
          </label>
          <label className="field">
            <span>City (optional)</span>
            <input name="city" placeholder="San Francisco" disabled={pending} />
          </label>
          <label className="field">
            <span>Device</span>
            <select name="device" defaultValue="DESKTOP" disabled={pending}>
              <option value="DESKTOP">Desktop</option>
              <option value="MOBILE">Mobile</option>
            </select>
          </label>
          <label className="field">
            <span>Timezone</span>
            <input
              name="timezone"
              defaultValue={defaultTimezone}
              aria-invalid={Boolean(fieldErrors?.timezone)}
              disabled={pending}
            />
            {fieldErrors?.timezone ? (
              <small className="field-error">{fieldErrors.timezone}</small>
            ) : (
              <small>IANA timezone, e.g. America/Los_Angeles.</small>
            )}
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Goal (optional)</h2>
            <p>
              Helps us prioritize what to surface first — you can change this
              anytime.
            </p>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label className="field">
            <span>What are you trying to do?</span>
            <select name="goalType" defaultValue="" disabled={pending}>
              {GOAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <input
              name="goalNotes"
              placeholder="e.g. Catch up to Acme in AI answers"
              disabled={pending}
            />
          </label>
        </div>
      </section>
    </>
  );
}
