import type { AuthSession, Workspace } from "@/lib/api/types";

export const SESSION_STORAGE_KEY = "farmacograph.studio.session";
export const WORKSPACE_STORAGE_KEY = "farmacograph.studio.workspace";
export const AUTH_COOKIE_NAME = "farmacograph.studio.authenticated";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const GUEST_SESSION: AuthSession = {
  accessToken: null,
  refreshToken: null,
  apiKey: null,
  roles: [],
  scopes: [],
  displayName: "Signed out",
  email: null,
  expiresAt: null,
};

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: "ws-cv", name: "Cardiovascular", slug: "cardiovascular" },
  { id: "ws-default", name: "Default Workspace", slug: "default" },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function normalizeStoredSession(raw: Partial<AuthSession>): AuthSession {
  return {
    ...GUEST_SESSION,
    ...raw,
    roles: raw.roles?.length ? raw.roles : GUEST_SESSION.roles,
    scopes: raw.scopes?.length ? raw.scopes : GUEST_SESSION.scopes,
  };
}

function setAuthCookie(authenticated: boolean): void {
  if (!isBrowser()) return;
  if (authenticated) {
    document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;
  } else {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function loadSession(): AuthSession {
  if (!isBrowser()) return GUEST_SESSION;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return GUEST_SESSION;
    return normalizeStoredSession(JSON.parse(raw) as Partial<AuthSession>);
  } catch {
    return GUEST_SESSION;
  }
}

export function saveSession(session: AuthSession): void {
  if (!isBrowser()) return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  setAuthCookie(Boolean(session.accessToken || session.apiKey));
}

export function clearSession(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  setAuthCookie(false);
}

export function loadWorkspace(): Workspace {
  if (!isBrowser()) return DEFAULT_WORKSPACES[0];
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACES[0];
    return JSON.parse(raw) as Workspace;
  } catch {
    return DEFAULT_WORKSPACES[0];
  }
}

export function saveWorkspace(workspace: Workspace): void {
  if (!isBrowser()) return;
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

export function isSessionAuthenticated(session: AuthSession): boolean {
  return Boolean(session.accessToken || session.apiKey);
}
