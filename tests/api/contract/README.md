# API contract tests

These tests validate live FastAPI responses against `openapi/openapi.yaml` using JSON Schema (`jsonschema`).

Run:

```bash
uv run pytest tests/api/contract/ -m contract
```

## Intentionally skipped tests

| Test | Reason |
|------|--------|
| `test_drugs_contract.py::test_drug_graph_contract` | `GET /drugs/{drug_id}/graph` is documented in OpenAPI but not implemented in FastAPI yet. Unskip when the graph projection route ships. |
| `test_evidence_contract.py::test_get_evidence_detail_openapi_when_present` | Skips when the evidence list is empty (no Neo4j seed data in contract test env). |
| `test_evidence_contract.py::test_create_evidence_openapi_envelope` | Skips when `POST /evidence` returns 503 (`FG_NEO4J_ENABLED=false` in contract tests). Unskip in CI with Neo4j enabled. |
| `test_evidence_contract.py::test_attach_evidence_to_drug_openapi_envelope` | Skips on 503 (Neo4j off) or 404 (no seeded drug/evidence graph). |
| `test_evidence_contract.py::test_attach_evidence_to_assertion_openapi_envelope` | Skips on 503 (Neo4j off) or 404 (no seeded clinical assertion). |

## Coverage notes

- **Auth** (`/auth/token`, `/auth/refresh`, `/auth/introspect`): `test_auth_contract.py` covers introspect with Bearer JWT.
- **Dashboard** (`/dashboard`, `/audit-logs`, `/jobs`): documented in OpenAPI; envelope tests live in `tests/api/test_dashboard.py`.
- **Curator / validation**: `test_curator_contract.py` covers `/curator/validate` and `/curator/validation-summary`.
- **Evidence** (`/evidence`, `/evidence/{evidence_id}`, `/evidence/{evidence_id}/drugs/{drug_id}`, `/evidence/{evidence_id}/assertions`): `test_evidence_contract.py` validates OpenAPI path coverage and live read envelopes; write/link tests skip without Neo4j.
- **Health / info**: `test_health_contract.py` validates the `{data, meta}` envelope (health checks live under `data.checks`, not top-level).
