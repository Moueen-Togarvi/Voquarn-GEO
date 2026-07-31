import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL is required for browser CRUD tests",
);

test("create, edit, switch to, and delete a project", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const brandName = `E2E Brand ${suffix}`;

  await page.goto("/onboarding");
  await page.getByLabel("Brand name").fill(brandName);
  await page.getByLabel("Website").fill(`https://brand-${suffix}.test`);
  await page
    .getByLabel("What does your product do?")
    .fill("A test SaaS used to verify the onboarding flow.");
  await page
    .getByLabel("Specific category")
    .fill("Browser testing software for SaaS teams");
  await page.getByLabel("Competitor 1 name").fill("Alpha");
  await page
    .getByLabel("Competitor 1 website")
    .fill(`https://alpha-${suffix}.test`);
  await page.getByLabel("Competitor 2 name").fill("Beta");
  await page
    .getByLabel("Competitor 2 website")
    .fill(`https://beta-${suffix}.test`);
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/overview/);
  await expect(
    page.getByRole("heading", { name: `Good to have ${brandName} here.` }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Project settings" }).click();
  await page
    .getByLabel("Specific category")
    .fill("Updated browser testing software");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Changes saved" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByLabel(`Type ${brandName} to confirm`).fill(brandName);
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).not.toHaveURL(new RegExp(`/projects/.+/settings`));
});
