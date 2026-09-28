"""Full-stack publish->read proof — real PostgreSQL + Neo4j required.

Run ONLY against live services (never in unit CI):

    FG_FULLSTACK=1 FG_DATABASE_URL='postgresql+asyncpg://farmacograph:farmacograph@localhost:5433/farmacograph' \\
    FG_NEO4J_ENABLED=true FG_NEO4J_URI='bolt://localhost:7687' \\
    FG_NEO4J_USER=neo4j FG_NEO4J_PASSWORD=farmacograph \\
    .venv/bin/python -m pytest tests/integration/test_fullstack_publish_read.py -o addopts='' -q

Proves the new publish invariant end to end:
curator login -> save real staging package -> submit -> approve -> publish
(graph_write success) -> public reads served from Neo4j with NO
staging-fallback provenance anywhere.
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

FULLSTACK = os.environ.get("FG_FULLSTACK") == "1"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not FULLSTACK, reason="needs live PostgreSQL + Neo4j (FG_FULLSTACK=1)"),
]

STAGING_METOPROLOL = (
    Path(__file__).resolve().parents[2]
    / "staging"
    / "cardiovascular"
    / "drugs"
    / "metoprolol.json"
)


@pytest_asyncio.fixture
async def fullstack_curator():
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container, reset_container
    from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user

    reset_container()
    app = create_app()
    container = get_container()
    try:
        await container.startup()
    except Exception as exc:
        reset_container()
        pytest.skip(f"full-stack services unreachable: {exc}")
    # Neo4j must really be connected — otherwise this is a staging demo.
    if not container.graph_repo.is_available:
        await container.shutdown()
        reset_container()
        pytest.skip("Neo4j driver not connected")
    # Shared DB persists across runs: seed a unique user per run instead of the
    # fixed helper email.
    user, _ = await seed_curator_user(
        container.session_factory, email=f"fullstack-{uuid.uuid4().hex[:8]}@test.local"
    )
    settings = get_settings()
    auth = bearer_headers(curator_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()
    reset_container()


def _real_package() -> dict:
    return json.loads(STAGING_METOPROLOL.read_text(encoding="utf-8"))


@pytest.mark.asyncio
async def test_fullstack_publish_then_read_without_fallback(fullstack_curator: AsyncClient):
    package = _real_package()
    entity_id = package["entity_payload"]["id"]

    created = await fullstack_curator.post(
        "/api/v1/curator/workflows",
        json={"entity_id": entity_id, "entity_type": "Drug"},
    )
    assert created.status_code == 201
    workflow_id = created.json()["data"]["id"]

    saved = await fullstack_curator.put(
        f"/api/v1/curator/workflows/{workflow_id}/package", json=package
    )
    assert saved.status_code == 200

    assert (
        await fullstack_curator.post(f"/api/v1/curator/workflows/{workflow_id}/submit")
    ).status_code == 200
    assert (
        await fullstack_curator.post(f"/api/v1/curator/workflows/{workflow_id}/approve")
    ).status_code == 200

    published = await fullstack_curator.post(
        f"/api/v1/curator/workflows/{workflow_id}/publish", json=package
    )
    assert published.status_code == 200, published.text
    body = published.json()["data"]
    assert body["workflow"]["state"] == "published"
    assert body["graph_write"]["status"] == "success"

    # Reader surface: everything from Neo4j, zero staging-fallback flags.
    for path in (
        f"/api/v1/drugs/{entity_id}",
        f"/api/v1/drugs/{entity_id}/mechanism",
        f"/api/v1/drugs/{entity_id}/graph?depth=2",
        f"/api/v1/drugs/{entity_id}/evidence",
    ):
        response = await fullstack_curator.get(path)
        assert response.status_code == 200, path
        meta = response.json()["meta"]
        assert meta.get("provenance") is None, f"{path} leaked staging: {meta}"

    compared = await fullstack_curator.post(
        "/api/v1/compare",
        json={
            "drug_ids": [entity_id, "2c31ee65-5805-5693-bdeb-01bb4829b1b9"],
            "dimensions": ["classes", "pharmacokinetics"],
        },
    )
    # Ramipril may or may not be published in this environment; either way the
    # response must be explicit — available data or honest no_data, never silent.
    assert compared.status_code == 200
    assert compared.json()["data"]["comparison"]["classes"]["status"] in (
        "available",
        "no_data",
    )
