"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./context";
import { loginRedirectUrl } from "./routes";

export function useRequireAuth(redirect = true) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!redirect || isLoading || isAuthenticated) return;
    router.replace(loginRedirectUrl(pathname));
  }, [redirect, isLoading, isAuthenticated, pathname, router]);

  return { isAuthenticated, isLoading };
}

export function usePermissions() {
  const { session, hasRole, hasScope, hasPermission } = useAuth();
  return {
    roles: session.roles,
    scopes: session.scopes,
    hasRole,
    hasScope,
    hasPermission,
  };
}
