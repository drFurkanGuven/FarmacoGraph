import { expect, test } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";

test.describe("Validation route smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
  });

  test("validation center page loads", async ({ page }) => {
    const response = await page.goto("/validation");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Validation Center" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
});
