import type { Page } from "@playwright/test";

export const AUTH_COOKIE_NAME = "farmacograph.studio.authenticated";
const SESSION_STORAGE_KEY = "farmacograph.studio.session";

const E2E_SESSION = {
  accessToken: null,
  refreshToken: null,
  apiKey: "fg_e2e_smoke_test_key",
  roles: ["curator", "reviewer"],
  scopes: ["curator:write", "curator:publish", "knowledge:read", "knowledge:search"],
  displayName: "E2E Curator",
  email: "e2e@test.local",
  expiresAt: null,
};

/** Bypass middleware and client auth guards for protected Studio routes during smoke E2E. */
export async function authenticateStudio(page: Page): Promise<void> {
  const port = process.env.PLAYWRIGHT_PORT ?? "3000";
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: "1",
      url: baseURL,
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(
    ({ cookieName, sessionKey, session }) => {
      localStorage.setItem(sessionKey, JSON.stringify(session));
      document.cookie = `${cookieName}=1; path=/; SameSite=Lax`;
    },
    {
      cookieName: AUTH_COOKIE_NAME,
      sessionKey: SESSION_STORAGE_KEY,
      session: E2E_SESSION,
    },
  );
}
