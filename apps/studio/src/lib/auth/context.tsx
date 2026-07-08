"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthSession, UserRole, Workspace } from "@/lib/api/types";

const STORAGE_KEY = "farmacograph.studio.session";
const WORKSPACE_KEY = "farmacograph.studio.workspace";

const DEFAULT_WORKSPACES: Workspace[] = [
  { id: "ws-cv", name: "Cardiovascular", slug: "cardiovascular" },
  { id: "ws-default", name: "Default Workspace", slug: "default" },
];

const GUEST_SESSION: AuthSession = {
  accessToken: null,
  refreshToken: null,
  apiKey: null,
  roles: ["viewer"],
  displayName: "Guest Curator",
  email: null,
};

interface AuthContextValue {
  session: AuthSession;
  isAuthenticated: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  setActiveWorkspace: (workspace: Workspace) => void;
  signIn: (patch: Partial<AuthSession>) => void;
  signOut: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): AuthSession {
  if (typeof window === "undefined") return GUEST_SESSION;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return GUEST_SESSION;
    return { ...GUEST_SESSION, ...JSON.parse(raw) };
  } catch {
    return GUEST_SESSION;
  }
}

function loadWorkspace(): Workspace {
  if (typeof window === "undefined") return DEFAULT_WORKSPACES[0];
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return DEFAULT_WORKSPACES[0];
    return JSON.parse(raw) as Workspace;
  } catch {
    return DEFAULT_WORKSPACES[0];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>(GUEST_SESSION);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace>(DEFAULT_WORKSPACES[0]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setActiveWorkspaceState(loadWorkspace());
    setHydrated(true);
  }, []);

  const persistSession = useCallback((next: AuthSession) => {
    setSession(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const signIn = useCallback(
    (patch: Partial<AuthSession>) => {
      const next = { ...session, ...patch };
      if (patch.apiKey && !patch.roles) {
        next.roles = ["curator", "reviewer"];
      }
      if (patch.accessToken && !patch.roles) {
        next.roles = ["curator"];
      }
      persistSession(next);
    },
    [persistSession, session],
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(GUEST_SESSION);
  }, []);

  const setActiveWorkspace = useCallback((workspace: Workspace) => {
    setActiveWorkspaceState(workspace);
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      const roles = Array.isArray(role) ? role : [role];
      return roles.some((r) => session.roles.includes(r));
    },
    [session.roles],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session.accessToken || session.apiKey),
      workspaces: DEFAULT_WORKSPACES,
      activeWorkspace,
      setActiveWorkspace,
      signIn,
      signOut,
      hasRole,
    }),
    [session, activeWorkspace, setActiveWorkspace, signIn, signOut, hasRole],
  );

  if (!hydrated) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
