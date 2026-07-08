"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { ApiEnvelope } from "../types";

export interface OptimisticContext<TCache> {
  previous?: TCache;
}

export interface OptimisticUpdateConfig<TVariables, TCache> {
  queryKey: QueryKey;
  updater: (current: TCache | undefined, variables: TVariables) => TCache;
}

export function applyOptimisticUpdate<TVariables, TCache>(
  queryClient: QueryClient,
  config: OptimisticUpdateConfig<TVariables, TCache>,
  variables: TVariables,
): OptimisticContext<TCache> {
  const previous = queryClient.getQueryData<TCache>(config.queryKey);
  queryClient.setQueryData<TCache>(config.queryKey, (current) => config.updater(current, variables));
  return { previous };
}

export function rollbackOptimisticUpdate<TCache>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  context?: OptimisticContext<TCache>,
): void {
  if (context?.previous !== undefined) {
    queryClient.setQueryData(queryKey, context.previous);
  }
}

export function createOptimisticMutationOptions<TData, TVariables, TCache>(config: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  updater: (current: TCache | undefined, variables: TVariables) => TCache;
  invalidateKeys?: QueryKey[];
}): Pick<
  UseMutationOptions<TData, Error, TVariables, OptimisticContext<TCache>>,
  "onMutate" | "onError" | "onSettled"
> {
  return {
    onMutate: async (variables) => {
      await config.queryClient.cancelQueries({ queryKey: config.queryKey });
      return applyOptimisticUpdate(config.queryClient, config, variables);
    },
    onError: (_error, _variables, context) => {
      rollbackOptimisticUpdate(config.queryClient, config.queryKey, context);
    },
    onSettled: async () => {
      await config.queryClient.invalidateQueries({ queryKey: config.queryKey });
      for (const key of config.invalidateKeys ?? []) {
        await config.queryClient.invalidateQueries({ queryKey: key });
      }
    },
  };
}

export function useOptimisticMutation<TData, TVariables, TCache = ApiEnvelope<unknown>>(
  options: UseMutationOptions<TData, Error, TVariables, OptimisticContext<TCache>> & {
    optimistic?: OptimisticUpdateConfig<TVariables, TCache>;
    invalidateKeys?: QueryKey[];
  },
): UseMutationResult<TData, Error, TVariables, OptimisticContext<TCache>> {
  const queryClient = useQueryClient();
  const { optimistic, invalidateKeys, ...mutationOptions } = options;

  const optimisticHandlers = optimistic
    ? createOptimisticMutationOptions({
        queryClient,
        queryKey: optimistic.queryKey,
        updater: optimistic.updater,
        invalidateKeys,
      })
    : {};

  return useMutation({
    ...mutationOptions,
    ...optimisticHandlers,
    onMutate: async (variables, context) => {
      const optimisticContext = optimistic
        ? await optimisticHandlers.onMutate?.(variables, context)
        : undefined;
      const userContext = await mutationOptions.onMutate?.(variables, context);
      return { ...optimisticContext, ...userContext };
    },
    onError: (error, variables, context, meta) => {
      optimisticHandlers.onError?.(error, variables, context, meta);
      mutationOptions.onError?.(error, variables, context, meta);
    },
    onSettled: (data, error, variables, context, meta) => {
      optimisticHandlers.onSettled?.(data, error, variables, context, meta);
      mutationOptions.onSettled?.(data, error, variables, context, meta);
    },
  });
}

export function useApiQuery<TData>(
  queryKey: QueryKey,
  queryFn: () => Promise<ApiEnvelope<TData>>,
  options?: Omit<UseQueryOptions<ApiEnvelope<TData>>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  });
}
