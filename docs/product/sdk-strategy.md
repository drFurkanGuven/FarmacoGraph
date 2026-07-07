# FarmacoGraph SDK Strategy

> Official SDKs generated from `openapi/openapi.yaml` wherever possible.

## Target Languages

| Language | Priority | Generator | Package |
|----------|----------|-----------|---------|
| Python | P0 | openapi-generator | `farmacograph-sdk` |
| TypeScript | P0 | openapi-generator | `@farmacograph/sdk` |
| Go | P1 | oapi-codegen | `github.com/farmacograph/sdk-go` |
| Rust | P2 | progenitor / openapi-generator | `farmacograph-sdk` |
| Java | P2 | openapi-generator | `org.farmacograph:sdk` |
| Swift | P3 | openapi-generator | `FarmacoGraphSDK` |
| Kotlin | P3 | openapi-generator | `org.farmacograph:sdk-kotlin` |

## SDK Design Principles

1. **OpenAPI is source of truth** — manual SDK patches only for ergonomics
2. **Snapshot pinning** — `dataset_version` on client constructor
3. **Content layers** — `layers=["biomedical", "education"]` helper
4. **Typed responses** — full type coverage from spec schemas
5. **Retry + rate limit** — exponential backoff on 429
6. **No graph DB access** — SDK talks to API only

## Python Example (Target)

```python
from farmacograph_sdk import FarmacoGraphClient

client = FarmacoGraphClient(
    api_key="fg_live_...",
    dataset_version="2027.1.0",
)
drugs = client.drugs.list(module="cardiovascular")
explanation = client.explain(drug="ramipril", effect="dry-cough")
```

## CI Integration (Phase 4+)

```bash
openapi-generator-cli generate -i openapi/openapi.yaml -g python -o sdks/python
openapi-generator-cli generate -i openapi/openapi.yaml -g typescript-fetch -o sdks/typescript
```

SDK releases track API minor versions; breaking changes require major SDK bump.
