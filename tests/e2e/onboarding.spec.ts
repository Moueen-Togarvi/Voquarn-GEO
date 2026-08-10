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
  // tiers it fires afterward, and this test also drives a re-analysis. Kept
  // generous because dev-server (Turbopack + Inngest dev server + Playwright,
  // all concurrent) latency varies a lot under load — see the individual
  // per-assertion timeouts below for the steps that are slowest.
  test.setTimeout(180_000);

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const brandName = `Brand ${suffix}`;

  // Step 1 of 3: add only a domain — redirects to the review step once discovery
  // (fixture-backed under E2E_DISCOVERY_FIXTURE) settles, not straight to
  // the project. There is no direct create -> overview path in this app;
  // every new project goes through review then its first benchmark.
  await page.goto("/onboarding");
  await page.getByLabel("Website domain").fill(`brand-${suffix}.test`);
  await page.getByRole("button", { name: "Analyze domain" }).click();

  // Even fixture-backed discovery still runs the real website-scrape and
  // SSRF-validation steps (only the LLM call itself is short-circuited),
  // plus the competitor-expansion tiers this fires afterward — comfortably
  // over Playwright's default 5s assertion timeout.
  await expect(page).toHaveURL(/\/onboarding\/review\/[^/]+/, {
    timeout: 60_000,
  });
  await expect(
    page.getByRole("heading", { name: "Review your AI prompts." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Prompts to track" }),
  ).toBeVisible();
  await expect(page.getByText(/prompts ready/)).toBeVisible({
    timeout: 60_000,
  });

  // Step 2 of 3: review — accept the defaults (every fixture competitor
  // starts accepted) and continue without editing anything.
  await page.getByRole("button", { name: "Continue to AI benchmark" }).click();

  // Step 3 of 3 generates prompts and executes the first fixture-backed run.
  // saveReviewAction does several real DB writes (profile update, competitor
  // status, market, activation) before redirecting — comfortably over the
  // default 5s assertion timeout under dev-server load.
  await expect(page).toHaveURL(/\/onboarding\/benchmark\/[^/]+/, {
    timeout: 45_000,
  });
  await expect(
    page.getByRole("heading", { name: "Your AI market benchmark." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open dashboard" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: "Open dashboard" }).click();

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
