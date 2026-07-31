export default function Loading() {
  return (
    <main className="center-page" aria-busy="true" aria-label="Loading">
      <div className="loading-mark">V</div>
      <p className="muted-text">Loading your workspace…</p>
    </main>
  );
}
