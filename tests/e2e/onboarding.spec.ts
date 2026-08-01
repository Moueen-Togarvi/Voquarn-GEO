import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL is required for browser CRUD tests",
);

test("create, edit, switch to, and delete a project", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const brandName = `E2E Brand ${suffix}`;

  await page.goto("/onboarding");
  await page.getByLabel("Company name").fill(brandName);
  await page.getByLabel("Company website").fill(`https://brand-${suffix}.test`);
  await page.getByRole("button", { name: "Research & create project" }).click();

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
