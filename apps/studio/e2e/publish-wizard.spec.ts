import { test, expect } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";
import { mockDrugBrowserApi, mockPublishWizardApi } from "./helpers/drugs-api";

test.describe("Publish wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
    await mockDrugBrowserApi(page);
    await mockPublishWizardApi(page);
  });

  test("opens publish wizard from drug editor", async ({ page }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflow state" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation readiness" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeVisible();
  });
});
