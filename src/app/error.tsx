"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replaced by the structured reporter in Phase 1a.
    console.error(error);
  }, [error]);

  return (
    <main className="center-page">
      <div className="empty-icon">!</div>
      <h1>Something went wrong</h1>
      <p className="muted-text">
        The page could not be loaded. Retrying often resolves a transient
        failure.
      </p>
      {error.digest ? (
        <p className="muted-text">
          Reference this ID if you contact support: <code>{error.digest}</code>
        </p>
      ) : null}
      <button className="button button-primary" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
