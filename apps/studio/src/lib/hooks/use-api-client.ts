"use client";

import { useMemo } from "react";
import { createApiClient } from "@/lib/api";
import { resolveStudioApiUrl } from "@/lib/api/base-url";
import { useAuth } from "@/lib/auth/context";

const DEFAULT_DATASET_VERSION = process.env.NEXT_PUBLIC_DATASET_VERSION ?? null;

export function useApiClient() {
  const { session, signOut, refreshSession } = useAuth();

  return useMemo(
    () =>
      createApiClient({
        baseUrl: resolveStudioApiUrl(),
        getSession: () => session,
        getDatasetVersion: () => DEFAULT_DATASET_VERSION,
        refreshSession,
        onUnauthorized: signOut,
      }),
    [session, signOut, refreshSession],
  );
}
