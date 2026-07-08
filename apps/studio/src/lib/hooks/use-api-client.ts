"use client";

import { useMemo } from "react";
import { createApiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth/context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001/api/v1";
const DEFAULT_DATASET_VERSION = process.env.NEXT_PUBLIC_DATASET_VERSION ?? null;

export function useApiClient() {
  const { session, signOut, refreshSession } = useAuth();

  return useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getSession: () => session,
        getDatasetVersion: () => DEFAULT_DATASET_VERSION,
        refreshSession,
        onUnauthorized: signOut,
      }),
    [session, signOut, refreshSession],
  );
}
