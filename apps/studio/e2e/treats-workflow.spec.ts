import { expect, test } from "@playwright/test";
import { authenticateStudio } from "./helpers/auth";
import { mockEvidenceWorkflowApi } from "./helpers/evidence-api";

async function openIndicationsSection(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation", { name: "Drug editor sections" })
    .getByRole("button", { name: "Indications" })
    .click();
  await expect(page.getByRole("heading", { name: "Indications", level: 2 })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel("Treats")).toBeVisible({ timeout: 15_000 });
}

async function selectHypertension(page: import("@playwright/test").Page) {
  const diseaseButton = page.getByRole("button", { name: "Hypertension hypertension" });
  await expect(diseaseButton).toBeVisible({ timeout: 15_000 });
  await diseaseButton.click();
  await expect(page.getByText("Indication metadata")).toBeVisible();
}

test.describe("TREATS indication workflow", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await authenticateStudio(page);
    await mockEvidenceWorkflowApi(page);
  });

  test("indications metadata incomplete until explanation and attestation are set", async ({ page }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await openIndicationsSection(page);
    await selectHypertension(page);
    await expect(page.getByText("Incomplete")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  });

  test("indications expert consensus path reaches publish-ready submit", async ({ page }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await openIndicationsSection(page);
    await selectHypertension(page);

    await page
      .getByLabel("Clinical explanation")
      .fill("ACE inhibition lowers blood pressure in essential hypertension.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Incomplete")).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole("navigation", { name: "Drug editor sections" })
      .getByRole("button", { name: "Provenance" })
      .click();
    await page.getByRole("textbox", { name: "Curator attestation" }).fill("true");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });

    await openIndicationsSection(page);
    await expect(page.getByText("Publish ready").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await page.getByRole("button", { name: "Refresh validation" }).click();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeEnabled({
      timeout: 15_000,
    });
  });

  test("indications can link attached evidence for non-expert evidence levels", async ({ page }) => {
    await page.goto("/knowledge/drugs/ramipril");
    await expect(page.getByLabel("Slug")).toHaveValue("ramipril", { timeout: 15_000 });

    await openIndicationsSection(page);
    await selectHypertension(page);

    await page
      .getByLabel("Clinical explanation")
      .fill("Supported by guideline-level evidence for hypertension.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Evidence level").selectOption("A");
    await expect(page.getByText("E2E catalog citation stub")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /E2E catalog citation stub/i }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Publish ready").first()).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole("navigation", { name: "Drug editor sections" })
      .getByRole("button", { name: "Provenance" })
      .click();
    await page.getByRole("textbox", { name: "Curator attestation" }).fill("true");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { name: "Publish wizard" })).toBeVisible();
    await page.getByRole("button", { name: "Refresh validation" }).click();
    await expect(page.getByRole("button", { name: "Submit for review" })).toBeEnabled({
      timeout: 15_000,
    });
  });
});
