"use client";

import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "./use-api-client";

export function useHealth() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["health"],
    queryFn: () => client.health(),
  });
}

export function useInfo() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["info"],
    queryFn: () => client.info(),
  });
}

export function useStatistics() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["statistics"],
    queryFn: () => client.statistics(),
  });
}

export function useModules() {
  const client = useApiClient();
  return useQuery({
    queryKey: ["modules"],
    queryFn: () => client.modules(),
  });
}

export function useCurriculum(moduleSlug: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["curriculum", moduleSlug],
    queryFn: () => client.curriculum(moduleSlug),
    enabled: Boolean(moduleSlug),
  });
}

export function useCuratorQueue(state: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["curator-queue", state],
    queryFn: () => client.curatorQueue(state),
  });
}

export function usePublishedDrugs(module?: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: ["drugs", module],
    queryFn: () => client.drugs(module),
  });
}
