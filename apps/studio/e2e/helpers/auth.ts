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
