"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuthSession, UserRole, Workspace } from "@/lib/api/types";
import { authApi, AuthApiError, isAuthEndpointUnavailable } from "./api";
import { hasPermission, hasRole, resolveSessionScopes, rolesFromScopes } from "./roles";
import { normalizeScopes } from "./scopes";
import {
  clearSession,
  DEFAULT_WORKSPACES,
  GUEST_SESSION,
  isSessionAuthenticated,
  loadSession,
  loadWorkspace,
  saveSession,
  saveWorkspace,
} from "./storage";
import { isTokenExpired, sessionFromAccessToken } from "./tokens";

interface AuthContextValue {
  session: AuthSession;
  isAuthenticated: boolean;
  isLoading: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace: (workspace: Workspace) => void;
  signIn: (patch: Partial<AuthSession>) => void;
  signOut: () => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithApiKey: (apiKey: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken?: string | null) => void;
  refreshSession: () => Promise<boolean>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasScope: (scope: Parameters<typeof hasPermission>[1]) => boolean;
  hasPermission: (permission: Parameters<typeof hasPermission>[1]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildSession(patch: Partial<AuthSession>, previous: AuthSession = GUEST_SESSION): AuthSession {
  const next: AuthSession = {
    ...previous,
    ...patch,
    roles: patch.roles ?? previous.roles,
    scopes: patch.scopes ?? previous.scopes,
  };

  if (patch.accessToken) {
    const fromJwt = sessionFromAccessToken(patch.accessToken, patch.refreshToken ?? next.refreshToken);
    next.accessToken = fromJwt.accessToken;
    next.refreshToken = fromJwt.refreshToken;
    next.scopes = fromJwt.scopes;
    next.expiresAt = fromJwt.expiresAt;
    next.email = patch.email ?? fromJwt.email ?? next.email;
    next.displayName = patch.displayName ?? fromJwt.displayName;
    next.roles = rolesFromScopes(next.scopes);
    next.apiKey = null;
  } else if (patch.apiKey) {
    next.apiKey = patch.apiKey;
    next.accessToken = null;
    next.refreshToken = null;
    next.expiresAt = null;
    if (!patch.roles?.length) next.roles = ["curator", "reviewer"];
    if (!patch.scopes?.length) next.scopes = resolveSessionScopes(undefined, next.roles);
  }

  next.scopes = resolveSessionScopes(next.scopes, next.roles);
  next.roles = patch.roles?.length ? patch.roles : rolesFromScopes(next.scopes);

  return next;
}

function applyTokenResponse(
  response: Awaited<ReturnType<typeof authApi.loginWithPassword>>,
  fallback: Partial<AuthSession> = {},
): AuthSession {
  const scopes = normalizeScopes(response.scopes);
  const session = buildSession({
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    apiKey: null,
    scopes,
    roles: rolesFromScopes(scopes),
    email: response.email ?? fallback.email ?? null,
    displayName: response.name ?? fallback.displayName ?? "Authenticated user",
  });
  return session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(GUEST_SESSION);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace>(DEFAULT_WORKSPACES[0]);
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    setSession(loadSession());
    setActiveWorkspaceState(loadWorkspace());
    setHydrated(true);
  }, []);

  const persistSession = useCallback((next: AuthSession) => {
    setSession(next);
    saveSession(next);
  }, []);

  const signIn = useCallback((patch: Partial<AuthSession>) => {
    setSession((current) => {
      const next = buildSession(patch, current);
      saveSession(next);
      return next;
    });
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(GUEST_SESSION);
  }, []);

  const loginWithTokens = useCallback(
    (accessToken: string, refreshToken?: string | null) => {
      persistSession(buildSession({ accessToken, refreshToken: refreshToken ?? null }));
    },
    [persistSession],
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await authApi.loginWithPassword({ email, password });
        persistSession(applyTokenResponse(response, { email, displayName: email }));
      } catch (error) {
        if (isAuthEndpointUnavailable(error)) {
          throw new AuthApiError(
            "Password login is not available yet. Use API key or paste a JWT in Settings.",
            501,
          );
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [persistSession],
  );

  const loginWithApiKey = useCallback(
    async (apiKey: string) => {
      setIsLoading(true);
      try {
        const response = await authApi.loginWithApiKey({ apiKey });
        persistSession(applyTokenResponse(response));
      } catch (error) {
        if (isAuthEndpointUnavailable(error)) {
          persistSession(
            buildSession({
              apiKey,
              roles: ["curator", "reviewer"],
              displayName: "API key user",
            }),
          );
          return;
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [persistSession],
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = async (): Promise<boolean> => {
      if (!session.refreshToken) return false;
      try {
        const response = await authApi.refreshToken({ refreshToken: session.refreshToken });
        persistSession(applyTokenResponse(response, session));
        return true;
      } catch (error) {
        if (!isAuthEndpointUnavailable(error)) signOut();
        return false;
      }
    };

    refreshInFlight.current = run().finally(() => {
      refreshInFlight.current = null;
    });
    return refreshInFlight.current;
  }, [persistSession, session, signOut]);

  useEffect(() => {
    if (!hydrated || !session.refreshToken || !session.expiresAt) return;
    if (!isTokenExpired(session.expiresAt)) return;
    void refreshSession();
  }, [hydrated, refreshSession, session.expiresAt, session.refreshToken]);

  const setActiveWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspaceState(workspace);
    saveWorkspace(workspace);
  }, []);

  const checkRole = useCallback(
    (role: UserRole | UserRole[]) => hasRole(session.roles, role),
    [session.roles],
  );

  const checkScope = useCallback(
    (scope: Parameters<typeof hasPermission>[1]) => hasPermission(session.scopes, scope),
    [session.scopes],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: isSessionAuthenticated(session),
      isLoading,
      workspaces: DEFAULT_WORKSPACES,
      activeWorkspace,
      setActiveWorkspace,
      signIn,
      signOut,
      loginWithPassword,
      loginWithApiKey,
      loginWithTokens,
      refreshSession,
      hasRole: checkRole,
      hasScope: checkScope,
      hasPermission: checkScope,
    }),
    [
      session,
      isLoading,
      activeWorkspace,
      setActiveWorkspace,
      signIn,
      signOut,
      loginWithPassword,
      loginWithApiKey,
      loginWithTokens,
      refreshSession,
      checkRole,
      checkScope,
    ],
  );

  if (!hydrated) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
