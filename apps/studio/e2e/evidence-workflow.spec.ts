import { expect, test } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";
import { mockEvidenceWorkflowApi } from "./helpers/evidence-api";

test.describe("Evidence workflow", () => {
  let evidenceApi: Awaited<ReturnType<typeof mockEvidenceWorkflowApi>>;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
    evidenceApi = await mockEvidenceWorkflowApi(page);
  });

  test("login → ramipril → evidence section → validate → publish wizard evidence state", async ({ page }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await page.getByRole("navigation", { name: "Drug editor sections" }).getByRole("button", { name: "Evidence" }).click();
    await expect(page.getByRole("heading", { name: "Evidence", level: 2 })).toBeVisible();
    await expect(page.getByText("E2E catalog citation stub")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Package status")).toBeVisible();
    expect(evidenceApi.invalidDrugSlugEvidenceCalls).toEqual([]);

    await page.getByRole("navigation", { name: "Drug editor sections" }).getByRole("button", { name: "Provenance" }).click();
    await page.getByRole("textbox", { name: "Curator attestation" }).fill("true");
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
    await expect(page.getByText("Start a search")).toBeVisible({ timeout: 15_000 });
  });
});
