"use client";

import { useEffect } from "react";

// Replaces the root layout when it is the layout itself that failed, so this
// file must render its own <html> and <body> and cannot rely on globals.css.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
          gap: "0.75rem",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>
          Voquarn GEO is unavailable
        </h1>
        <p style={{ color: "#666", margin: 0 }}>
          The application failed to start. Please try again shortly.
        </p>
        {error.digest ? (
          <p style={{ color: "#666", margin: 0 }}>
            Reference ID: <code>{error.digest}</code>
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            background: "#5b48d9",
            border: 0,
            borderRadius: "0.5rem",
            color: "#fff",
            cursor: "pointer",
            padding: "0.6rem 1.1rem",
          }}
          type="button"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
