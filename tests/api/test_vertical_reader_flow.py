"""Vertical reader flow — public endpoints over staging data (no Neo4j).

Proves the connected vertical slice with real HTTP request/response pairs:
search -> drug list -> detail -> mechanism DAG -> evidence -> compare ->
interactions. Every assertion checks API-returned data; staging provenance is
asserted explicitly so sample content is never mistaken for published graph.
"""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def client():
    from farmacograph.api.main import create_app
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await container.shutdown()


async def _drug_ids(client: AsyncClient) -> dict[str, str]:
    r = await client.get("/api/v1/drugs", params={"limit": 100})
    assert r.status_code == 200, r.text
    items = r.json()["data"]
    assert len(items) >= 4, "vertical flow needs the four staging drugs"
    assert r.json()["meta"].get("provenance") == "staging-fallback"
    return {item["slug"]: item["id"] for item in items}


@pytest.mark.asyncio
async def test_vertical_search_lists_staging_drugs(client: AsyncClient):
    r = await client.get("/api/v1/search", params={"q": "ramipril"})
    assert r.status_code == 200
    slugs = [row["slug"] for row in r.json()["data"]]
    assert "ramipril" in slugs
    assert r.json()["meta"].get("provenance") == "staging-fallback"


@pytest.mark.asyncio
async def test_vertical_drug_detail_mechanism_evidence(client: AsyncClient):
    ids = await _drug_ids(client)
    metoprolol = ids["metoprolol"]

    detail = await client.get(f"/api/v1/drugs/{metoprolol}")
    assert detail.status_code == 200
    payload = detail.json()["data"]
    assert payload["slug"] == "metoprolol"
    assert payload["half_life"] and payload["bioavailability"]

    dag = await client.get(f"/api/v1/drugs/{metoprolol}/mechanism")
    assert dag.status_code == 200
    body = dag.json()["data"]
    assert body["root_fragment_id"]
    assert len(body["nodes"]) >= 2
    assert dag.json()["meta"].get("provenance") == "staging-fallback"

    evidence = await client.get(f"/api/v1/drugs/{metoprolol}/evidence")
    assert evidence.status_code == 200
    rows = evidence.json()["data"]
    assert len(rows) >= 1
    assert evidence.json()["meta"].get("provenance") == "staging-fallback"
    assert any(
        (row.get("evidence") or {}).get("evidence_type") == "rct" for row in rows
    )


@pytest.mark.asyncio
async def test_vertical_education_and_flashcards(client: AsyncClient):
    ids = await _drug_ids(client)
    metoprolol = ids["metoprolol"]

    education = await client.get(f"/api/v1/drugs/{metoprolol}/education")
    assert education.status_code == 200
    items = education.json()["data"]
    kinds = {item.get("kind") for item in items}
    assert {"Flashcard", "BoardExamPearl", "CommonMistake", "Mnemonic"} <= kinds
    assert education.json()["meta"].get("provenance") == "staging-fallback"

    flashcards = await client.get(f"/api/v1/drugs/{metoprolol}/education/flashcards")
    assert flashcards.status_code == 200
    cards = flashcards.json()["data"]
    assert len(cards) >= 2
    assert all(card.get("front") and card.get("back") for card in cards)


@pytest.mark.asyncio
async def test_vertical_compare_changes_with_drugs(client: AsyncClient):
    """Acceptance: changing drugs changes the backend comparison (no static table)."""
    ids = await _drug_ids(client)

    first = await client.post(
        "/api/v1/compare",
        json={
            "drug_ids": [ids["ramipril"], ids["metoprolol"]],
            "dimensions": ["classes", "indications", "mechanisms", "pharmacokinetics", "warnings"],
        },
    )
    assert first.status_code == 200
    comp_a = first.json()["data"]["comparison"]
    pk_a = comp_a["pharmacokinetics"]["by_drug"]

    second = await client.post(
        "/api/v1/compare",
        json={
            "drug_ids": [ids["losartan"], ids["spironolactone"]],
            "dimensions": ["classes", "indications", "mechanisms", "pharmacokinetics", "warnings"],
        },
    )
    assert second.status_code == 200
    comp_b = second.json()["data"]["comparison"]
    pk_b = comp_b["pharmacokinetics"]["by_drug"]

    # Different drug pairs must yield different backend payloads.
    assert pk_a != pk_b
    assert (
        pk_a[ids["ramipril"]]["half_life"]
        != pk_a[ids["metoprolol"]]["half_life"]
    )
    assert first.json()["meta"].get("provenance") == "staging-fallback"


@pytest.mark.asyncio
async def test_vertical_interactions_from_engine(client: AsyncClient):
    ids = await _drug_ids(client)
    r = await client.post(
        "/api/v1/interactions", json={"slugs": ["ramipril", "spironolactone"]}
    )
    assert r.status_code == 200
    body = r.json()["data"]
    assert isinstance(body["interactions"], list)
    assert len(body["checked_drugs"]) == 2
    assert r.json()["meta"].get("provenance") == "staging-fallback"
