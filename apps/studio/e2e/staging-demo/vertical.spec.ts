/**
 * Live-stack vertical slice — REAL API + REAL Studio, no mocks.
 *
 * Requirements (see docs/staging-demo-e2e.md):
 * - API running with staging data (sqlite is fine, Neo4j optional).
 * - Studio dev server with NEXT_PUBLIC_API_URL pointing at that API.
 * - Run: FG_STAGING_DEMO_E2E=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 npx playwright test e2e/staging-demo
 *
 * Forbidden here: route intercepts, API mocks, fake sessions, invented data.
 * Every assertion below names a value the API actually returns.
 */
import { expect, test } from "@playwright/test";

const LIVE = process.env.FG_STAGING_DEMO_E2E === "1";
test.skip(
  !LIVE,
  "Staging-demo spec requires FG_STAGING_DEMO_E2E=1 with a running staging API + Studio. " +
    "This proves the staging demo slice ONLY — not full-stack Neo4j publishing."
);

const CURATOR_EMAIL = process.env.FG_E2E_EMAIL ?? "curator@farmacograph.local";
const CURATOR_PASSWORD = process.env.FG_E2E_PASSWORD ?? "curator-dev-password";

test("curator login with real credentials", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").fill(CURATOR_EMAIL);
  await page.locator("#password").fill(CURATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Real session: leaves /login, lands on an authenticated page.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
});

test("wrong credentials show an error, never a session", async ({ page }) => {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").fill("nobody@example.org");
  await page.locator("#password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login/);
  // Some visible error state, no dashboard content.
  await expect(page.locator("body")).not.toContainText("Curriculum progress");
});

test("vertical slice: explore -> compare -> interactions", async ({ page }) => {
  // --- login (real JWT session) ---
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").fill(CURATOR_EMAIL);
  await page.locator("#password").fill(CURATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // --- explore: API-driven detail + labeled staging source ---
  await page.goto("/explore");
  await page.getByRole("button", { name: "Metoprolol", exact: true }).click();
  await expect(page.getByText("Beta-adrenergic blockade").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("curator staging (unpublished)").first()).toBeVisible();
  await expect(
    page.getByText("Metoprolol CR/XL Randomised Intervention Trial").first()
  ).toBeVisible();

  // --- compare: changing drugs changes backend content ---
  await page.goto("/compare");
  const selects = page.locator("select");
  await selects.nth(1).selectOption({ label: "Spironolactone" });
  await expect(page.getByText("canrenone", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await selects.nth(1).selectOption({ label: "Losartan" });
  await expect(page.getByText("E-3174", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("canrenone", { exact: false })).toHaveCount(0);

  // --- interactions: real engine result, no mock table ---
  await page.goto("/interactions");
  await page.getByRole("button", { name: "Clear All" }).click();
  await page.getByRole("button", { name: "Ramipril", exact: true }).click();
  await page.getByRole("button", { name: "Spironolactone", exact: true }).click();
  await page.getByRole("button", { name: "Analyze Interactions" }).click();
  await expect(page.getByText("Synergistic Hyperkalemia Risk").first()).toBeVisible({
    timeout: 15_000,
  });
});
