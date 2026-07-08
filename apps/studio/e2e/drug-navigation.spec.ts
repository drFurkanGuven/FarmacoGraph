import { expect, test } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";
import { mockDrugBrowserApi, mockDrugEditorNotFound } from "./helpers/drugs-api";

test.describe("Drug browser navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
    await mockDrugBrowserApi(page);
  });

  test("row actions open ramipril in the drug editor", async ({ page }) => {
    await page.goto("/knowledge/drugs");
    await expect(page.getByRole("heading", { name: "Drug browser" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Actions for ramipril" })).toBeVisible();

    await page.getByRole("button", { name: "Actions for ramipril" }).click();
    await page.getByRole("menuitem", { name: "Open drug editor" }).click();

    await expect(page).toHaveURL(/\/knowledge\/drugs\/ramipril$/);
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril");
    await expect(page.getByLabel("Label")).toHaveValue("Ramipril");
    await expect(page.getByText("All changes saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation" })).toBeVisible();
    await expect(page.getByText("Package status")).toBeVisible();
  });

  test("drug label link navigates to the editor route", async ({ page }) => {
    await page.goto("/knowledge/drugs");
    await page.getByRole("link", { name: "ramipril" }).first().click();
    await expect(page).toHaveURL(/\/knowledge\/drugs\/ramipril$/);
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril");
  });

  test("shows a friendly error when the curator workflow cannot be opened", async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockDrugEditorNotFound(page, "missing-drug");
    await page.goto("/knowledge/drugs/missing-drug");

    await expect(page.getByRole("heading", { name: "Unable to open drug editor" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/missing-drug/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to drug browser" })).toBeVisible();
  });
});
