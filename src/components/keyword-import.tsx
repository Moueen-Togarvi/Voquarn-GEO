export function KeywordImport({ pending }: { pending: boolean }) {
  return (
    <section className="form-section">
      <div className="form-section-heading">
        <span className="step-number">3</span>
        <div>
          <h2>Keywords to track (optional)</h2>
          <p>
            One per line. You can bulk-import more later from project settings.
          </p>
        </div>
      </div>
      <label className="field field-span">
        <span>Keywords</span>
        <textarea
          name="keywords"
          rows={6}
          placeholder={
            "geo optimization tools\nai visibility tracking\nbest generative engine optimization software"
          }
          disabled={pending}
        />
        <small>Duplicate keywords are automatically skipped.</small>
      </label>
    </section>
  );
}
