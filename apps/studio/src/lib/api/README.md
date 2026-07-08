# FarmacoGraph Studio API Client

Typed HTTP client for the public FarmacoGraph REST API (`/api/v1`). Every Studio page should use this layer — never call Neo4j or PostgreSQL directly.

## Quick start

```tsx
import { useApiClient } from "@/lib/hooks/use-api-client";
import { useHealth, useCuratorQueue, useOptimisticMutation, apiQueryKeys } from "@/lib/api";

function Example() {
  const client = useApiClient();
  const health = useHealth();

  // Imperative
  const stats = await client.statistics();

  // React Query (preferred)
  const queue = useCuratorQueue("review");
}
```

## Architecture

| Module | Responsibility |
|--------|----------------|
| `client.ts` | Typed endpoint methods |
| `transport.ts` | Fetch execution, envelope parsing |
| `auth.ts` | Bearer token + `X-API-Key` headers |
| `headers.ts` | `X-Request-Id`, `X-FarmacoGraph-Client`, `X-Dataset-Version` |
| `interceptors.ts` | Request/response/error hook pipeline |
| `errors.ts` | `ApiError` + message normalization |
| `retry.ts` | Exponential backoff for 5xx / network failures |
| `pagination.ts` | `limit`/`offset` helpers + infinite-query support |
| `react-query/` | Query keys, default options, hooks, optimistic mutations |

## Configuration

```ts
import { createApiClient } from "@/lib/api";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001/api/v1",
  getSession: () => session,
  getDatasetVersion: () => "2026.1.0", // optional — sent as X-Dataset-Version
  onUnauthorized: () => signOut(),
});
```

## Interceptors

```ts
const client = createApiClient({ baseUrl, getSession: () => session });

client.interceptors.useRequest((ctx) => {
  // mutate ctx.headers before fetch
});

client.interceptors.useResponse((ctx) => {
  console.debug(ctx.traceId, ctx.envelope.meta.dataset_version);
});
```

## Pagination

```ts
import { buildPaginationParams, infiniteQueryGetNextPageParam } from "@/lib/api";

client.drugs({ module: "cardiovascular", limit: 50, offset: 0 });

// React Query infinite scroll
getNextPageParam: (lastPage, allPages) =>
  infiniteQueryGetNextPageParam(lastPage, allPages, 50);
```

## Optimistic mutations

```tsx
import { useOptimisticMutation, apiQueryKeys } from "@/lib/api";

const submit = useOptimisticMutation({
  mutationFn: (id: string) => client.submitWorkflow(id),
  optimistic: {
    queryKey: apiQueryKeys.curatorQueue("draft"),
    updater: (current, id) => ({
      ...current!,
      data: current!.data.filter((w) => w.id !== id),
    }),
  },
  invalidateKeys: [apiQueryKeys.curatorQueue("review")],
});
```

## Error handling

All failures throw `ApiError` with `status`, `code`, `traceId`, and normalized `message`. React Query defaults skip retries for 4xx responses.

```tsx
import { ApiError } from "@/lib/api";

if (error instanceof ApiError) {
  console.error(error.traceId, error.code, error.message);
}
```
