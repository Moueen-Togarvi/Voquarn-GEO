export default function ProjectLoading() {
  return (
    <div className="page-container" aria-busy="true" aria-label="Loading">
      <section className="content-card">
        <p className="muted-text">Loading project data…</p>
      </section>
    </div>
  );
}
