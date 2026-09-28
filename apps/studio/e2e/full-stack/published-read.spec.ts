/**
 * Full-stack published-read — REAL PostgreSQL + Neo4j + API + Studio, no mocks.
 *
 * Preconditions (see docs/full-stack-e2e.md):
 * - docker compose postgres + neo4j healthy,
 * - API with FG_NEO4J_ENABLED=true serving published graph data,
 * - at least one drug published to Neo4j (metoprolol via the API flow),
 * - Studio dev server with NEXT_PUBLIC_API_URL pointing at that API.
 *
 * Run: FG_FULLSTACK_E2E=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3003 \
 *   npx playwright test e2e/full-stack
 *
 * Forbidden here: route intercepts, API mocks, fake sessions, invented data.
 * The core assertion is NEGATIVE: no staging-fallback badge/text anywhere,
 * because every value on screen comes from the published graph.
 */
import { expect, test } from "@playwright/test";

const LIVE = process.env.FG_FULLSTACK_E2E === "1";
test.skip(!LIVE, "Full-stack spec requires FG_FULLSTACK_E2E=1 with PG + Neo4j + API + Studio.");

const CURATOR_EMAIL = process.env.FG_E2E_EMAIL ?? "curator@farmacograph.local";
const CURATOR_PASSWORD = process.env.FG_E2E_PASSWORD ?? "curator-dev-password";

test("published drug reads from Neo4j without staging fallback", async ({ page }) => {
  // --- real login ---
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").fill(CURATOR_EMAIL);
  await page.locator("#password").fill(CURATOR_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // --- explore: published graph data, explicitly NOT staging ---
  await page.goto("/explore");
  await page.getByRole("button", { name: "Metoprolol", exact: true }).click();
  await expect(page.getByText("Beta-adrenergic blockade").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("published graph").first()).toBeVisible();
  await expect(page.getByText("curator staging (unpublished)")).toHaveCount(0);
  await expect(
    page.getByText("Metoprolol CR/XL Randomised Intervention Trial").first()
  ).toBeVisible();

  // --- compare: backend content changes with selection, no staging badge ---
  await page.goto("/compare");
  const selects = page.locator("select");
  await selects.nth(1).selectOption({ label: "Metoprolol" });
  await expect(page.getByText("CYP2D6", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("curator staging (unpublished)")).toHaveCount(0);
});
