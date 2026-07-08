import { expect, test } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";
import { mockEvidenceWorkflowApi } from "./helpers/evidence-api";

test.describe("Evidence workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
    await mockEvidenceWorkflowApi(page);
  });

  test("login → ramipril → evidence section → create evidence → validate → publish wizard evidence state", async ({
    page,
  }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await page.getByRole("navigation", { name: "Drug editor sections" }).getByRole("button", { name: "Evidence" }).click();
    await expect(page.getByRole("heading", { name: "Evidence", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No evidence attached" })).toBeVisible();

    await page.getByRole("button", { name: "Create evidence" }).click();
    await expect(page.getByRole("heading", { name: "Create evidence" })).toBeVisible();
    await page.getByLabel("Title").fill("E2E curation citation stub");
    await page.getByRole("button", { name: "Create and attach" }).click();

    await expect(page.getByText("E2E curation citation stub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Attached", { exact: true }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Validation" })).toBeVisible();
    await expect(page.getByText("Package status")).toBeVisible();

    await page.getByRole("button", { name: "Provenance" }).click();
    await page.getByLabel("Curator attestation").fill("true");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await expect(page.getByText("Evidence readiness", { exact: true })).toBeVisible();
    await expect(page.getByText("Curator attestation is required before publishing.")).toHaveCount(0);
    await expect(page.locator("dd", { hasText: "Yes" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeEnabled();
  });

  test("publish wizard surfaces missing attestation in evidence readiness before provenance is fixed", async ({
    page,
  }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await expect(page.getByText("Evidence readiness", { exact: true })).toBeVisible();
    await expect(page.getByText("Curator attestation is required before publishing.").first()).toBeVisible();
    await expect(page.locator("dd", { hasText: "No" }).first()).toBeVisible();
  });

  test("global evidence manager route loads the evidence browser", async ({ page }) => {
    await page.goto("/knowledge/evidence");
    await expect(page.getByRole("heading", { name: "Evidence manager" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
});
