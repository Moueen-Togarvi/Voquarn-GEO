"use client";

import { useEffect } from "react";

import { PageHeader } from "@/components/page-header";

// Scoped to the project shell, so the sidebar and project switcher stay usable
// while a single section is failing.
export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Error"
        title="This section could not be loaded"
        description="The rest of the project is still available from the sidebar."
      />
      <section className="content-card">
        <div className="form-alert" role="alert">
          <p>{error.message || "An unexpected error occurred."}</p>
          {error.digest ? (
            <p>
              Reference ID: <code>{error.digest}</code>
            </p>
          ) : null}
        </div>
        <button className="button button-primary" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </div>
  );
}
