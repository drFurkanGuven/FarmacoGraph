#!/usr/bin/env python3
"""Check that all FastAPI endpoints in API v1 are documented in openapi/openapi.yaml."""

from __future__ import annotations

import sys
from pathlib import Path
import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from farmacograph.api.main import create_app


def main() -> int:
    openapi_file = PROJECT_ROOT / "openapi" / "openapi.yaml"
    if not openapi_file.is_file():
        print(f"Error: {openapi_file} does not exist", file=sys.stderr)
        return 1

    with open(openapi_file, encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    app = create_app()
    api_v1 = None
    for r in app.routes:
        if getattr(r, "path", "") == "/api/v1":
            api_v1 = r.app
            break

    if not api_v1:
        print("Error: /api/v1 mount not found in FastAPI app", file=sys.stderr)
        return 1

    fastapi_schema = api_v1.openapi()
    api_paths: set[tuple[str, str]] = set()
    for path, methods in fastapi_schema.get("paths", {}).items():
        for m in methods.keys():
            if m in ("get", "post", "put", "patch", "delete"):
                api_paths.add((m.upper(), path))

    spec_paths: set[tuple[str, str]] = set()
    for path, methods in spec.get("paths", {}).items():
        for m in methods.keys():
            if m in ("get", "post", "put", "patch", "delete"):
                spec_paths.add((m.upper(), path))

    missing = api_paths - spec_paths
    if missing:
        print(f"FAIL: {len(missing)} active FastAPI endpoint(s) missing from openapi/openapi.yaml:", file=sys.stderr)
        for m, p in sorted(missing):
            print(f"  - {m} /api/v1{p}", file=sys.stderr)
        return 1

    print(f"SUCCESS: All {len(api_paths)} FastAPI endpoints are documented in openapi/openapi.yaml.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
