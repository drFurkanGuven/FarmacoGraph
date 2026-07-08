"""OpenAPI contract validation helpers."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from jsonschema import RefResolver, validate

OPENAPI_PATH = Path(__file__).resolve().parents[3] / "openapi" / "openapi.yaml"


def load_openapi() -> dict[str, Any]:
    with OPENAPI_PATH.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def strip_nulls(value: Any) -> Any:
    """Remove null fields so optional OpenAPI properties with type-only schemas pass."""
    if isinstance(value, dict):
        return {key: strip_nulls(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [strip_nulls(item) for item in value]
    return value


def get_response_schema(
    spec: dict[str, Any],
    path: str,
    *,
    method: str = "get",
    status: str = "200",
) -> dict[str, Any]:
    return spec["paths"][path][method]["responses"][status]["content"]["application/json"]["schema"]


def validate_openapi_response(
    spec: dict[str, Any],
    path: str,
    body: dict[str, Any],
    *,
    method: str = "get",
    status: str = "200",
) -> None:
    schema = get_response_schema(spec, path, method=method, status=status)
    resolver = RefResolver.from_schema(spec)
    validate(strip_nulls(body), schema, resolver=resolver)


def assert_api_envelope(body: dict[str, Any]) -> None:
    assert "data" in body
    assert "meta" in body
    assert isinstance(body["meta"], dict)
    assert body["meta"].get("api_version") == "v1"
