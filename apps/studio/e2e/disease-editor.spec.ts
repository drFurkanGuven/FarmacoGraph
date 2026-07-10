import { test, expect } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";
import { mockDiseaseEditorApi } from "./helpers/diseases-api";

test.describe("Disease editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
    await mockDiseaseEditorApi(page);
  });

  test("opens disease editor with provenance and publish wizard", async ({ page }) => {
    await page.goto("/knowledge/diseases/hypertension");
    await expect(page.getByLabel("Slug")).toHaveValue("hypertension", { timeout: 15_000 });

    await page.getByRole("button", { name: "Provenance" }).click();
    await expect(page.getByLabel("Curator attestation")).toHaveValue("true");

    await expect(page.getByText("Live context")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Knowledge links" })).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflow state" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeVisible();
  });
});
