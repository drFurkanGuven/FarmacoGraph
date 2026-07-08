import { expect, test } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";

test.describe("Drugs route smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
  });

  test("drug browser page loads", async ({ page }) => {
    const response = await page.goto("/knowledge/drugs");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Drug browser" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
  });
});
