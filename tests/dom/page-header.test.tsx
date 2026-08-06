import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/page-header";

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Overview" description="Visibility summary." />);

    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(screen.getByText("Visibility summary.")).toBeVisible();
  });

  it("omits the eyebrow and action slots when not provided", () => {
    const { container } = render(
      <PageHeader title="Prompts" description="Prompt library." />,
    );

    expect(container.querySelector(".page-eyebrow")).toBeNull();
    expect(container.querySelector(".page-header-action")).toBeNull();
  });

  it("renders the eyebrow and action slots when provided", () => {
    render(
      <PageHeader
        eyebrow="Project"
        title="Sources"
        description="Cited domains."
        action={<button type="button">Run analysis</button>}
      />,
    );

    expect(screen.getByText("Project")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Run analysis" }),
    ).toBeInTheDocument();
  });
});
