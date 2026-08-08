import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL is required for browser CRUD tests",
);

test("create, review, configure market, edit, switch to, and delete a project", async ({
  page,
}) => {
  // Well over Playwright's 30s default: fixture-backed discovery still runs
  // real website-scrape/SSRF-validation steps plus the competitor-expansion
  // tiers it fires afterward, and this test also drives a re-analysis.
  test.setTimeout(90_000);

  const suffix = Date.now().toString(36);
  const brandName = `E2E Brand ${suffix}`;

  // Step 1 of 3: add company — redirects to the review step once discovery
  // (fixture-backed under E2E_DISCOVERY_FIXTURE) settles, not straight to
  // the project. There is no direct create -> overview path in this app;
  // every new project goes through review then market first.
  await page.goto("/onboarding");
  await page.getByLabel("Company name").fill(brandName);
  await page.getByLabel("Company website").fill(`https://brand-${suffix}.test`);
  await page.getByRole("button", { name: "Research & create project" }).click();

  // Even fixture-backed discovery still runs the real website-scrape and
  // SSRF-validation steps (only the LLM call itself is short-circuited),
  // plus the competitor-expansion tiers this fires afterward — comfortably
  // over Playwright's default 5s assertion timeout.
  await expect(page).toHaveURL(/\/onboarding\/review\/[^/]+/, {
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", { name: "Review what we found." }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Top \(\d+\)$/ })).toBeVisible();

  // Step 2 of 3: review — accept the defaults (every fixture competitor
  // starts accepted) and continue without editing anything.
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 of 3: market — every field has a usable default (US/en/UTC/Desktop),
  // so finishing setup needs no input.
  await expect(page).toHaveURL(/\/onboarding\/market\/[^/]+/);
  await expect(
    page.getByRole("heading", { name: "Where should we look?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish setup" }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/overview/);
  await expect(
    page.getByRole("heading", { name: `Good to have ${brandName} here.` }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Project settings" }).click();
  await expect(
    page.getByRole("heading", { name: "AI-discovered profile" }),
  ).toBeVisible();
  await expect(page.getByText("AI search visibility software")).toBeVisible();
  await page.getByRole("button", { name: "Re-analyze project" }).click();
  await expect(
    page.getByRole("button", { name: "Profile updated" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByLabel(`Type ${brandName} to confirm`).fill(brandName);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).not.toHaveURL(new RegExp(`/projects/.+/settings`));
});
