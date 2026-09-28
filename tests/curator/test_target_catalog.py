"""Target, receptor, and enzyme catalog unit & API tests."""

from __future__ import annotations

import os
from pathlib import Path
import uuid
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")

from farmacograph.core.container import reset_container
from farmacograph.curator import target_catalog as catalog
from tests.auth.helpers import bearer_headers, curator_token, seed_curator_user


@pytest.fixture(autouse=True)
def _runtime_target_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / "targets.runtime.json"
    monkeypatch.setenv("FG_TARGET_CATALOG_PATH", str(path))
    yield path


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    yield
    reset_container()


@pytest_asyncio.fixture
async def client():
    from farmacograph.api.main import create_app
    from farmacograph.core.config import get_settings
    from farmacograph.core.container import get_container

    app = create_app()
    container = get_container()
    await container.startup()
    user, _ = await seed_curator_user(
        container.session_factory, email=f"curator-{uuid.uuid4().hex[:8]}@test.local"
    )
    settings = get_settings()
    auth = bearer_headers(curator_token(settings, user.id))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth) as ac:
        yield ac
    await container.shutdown()


def test_validate_target_slug():
    assert catalog.validate_target_slug("adrb1") == "adrb1"
    assert catalog.validate_target_slug("  cyp2d6  ") == "cyp2d6"
    assert catalog.validate_target_slug("target-alpha-1") == "target-alpha-1"

    with pytest.raises(ValueError, match="Must be lowercase kebab-case"):
        catalog.validate_target_slug("ADRB1")

    with pytest.raises(ValueError, match="Must be lowercase kebab-case"):
        catalog.validate_target_slug("target_1")

    with pytest.raises(ValueError, match="Must be lowercase kebab-case"):
        catalog.validate_target_slug("target@123")


def test_list_target_catalog_from_shared_nodes():
    rows, total = catalog.list_target_catalog()
    assert total >= 4
    slugs = {r["slug"] for r in rows}
    assert "adrb1" in slugs
    assert "ace" in slugs
    assert "cyp2d6" in slugs
    assert "cyp2c9" in slugs


def test_register_target_protein_and_enzyme():
    target = catalog.register_target(
        entity_type="TargetProtein",
        slug="sglt2",
        label="Sodium/Glucose Cotransporter 2",
        gene_symbol="SLC5A2",
        description="Renal sodium-glucose transporter",
    )
    assert target["entity_type"] == "TargetProtein"
    assert target["slug"] == "sglt2"
    assert target["label"] == "Sodium/Glucose Cotransporter 2"
    assert target["gene_symbol"] == "SLC5A2"

    enzyme = catalog.register_target(
        entity_type="Enzyme",
        slug="cyp3a4",
        label="Cytochrome P450 3A4",
        gene_symbol="CYP3A4",
        is_cyp=True,
        cyp_family="CYP3A",
    )
    assert enzyme["entity_type"] == "Enzyme"
    assert enzyme["is_cyp"] is True
    assert enzyme["cyp_family"] == "CYP3A"

    rows, total = catalog.list_target_catalog(search="sglt2")
    assert total == 1
    assert rows[0]["slug"] == "sglt2"

    rows_enzymes, total_enzymes = catalog.list_target_catalog(entity_type="Enzyme")
    assert any(r["slug"] == "cyp3a4" for r in rows_enzymes)


def test_register_target_rejects_duplicate_or_invalid():
    catalog.register_target(
        entity_type="Receptor",
        slug="drd2",
        label="Dopamine Receptor D2",
    )
    with pytest.raises(ValueError, match="already exists"):
        catalog.register_target(
            entity_type="Receptor",
            slug="drd2",
            label="Dopamine D2 Duplicate",
        )

    with pytest.raises(ValueError, match="Invalid molecular entity_type"):
        catalog.register_target(
            entity_type="Drug",
            slug="fake-target",
            label="Fake",
        )

    with pytest.raises(ValueError, match="Target label is required"):
        catalog.register_target(
            entity_type="TargetProtein",
            slug="valid-slug",
            label="  ",
        )


@pytest.mark.asyncio
async def test_curator_targets_api_endpoints(client: AsyncClient):
    # GET /api/v1/curator/targets
    resp = await client.get("/api/v1/curator/targets")
    assert resp.status_code == 200
    res = resp.json()
    assert "data" in res
    assert "meta" in res
    assert res["meta"]["total"] >= 4

    # Filter by entity_type=Receptor
    resp = await client.get("/api/v1/curator/targets?entity_type=Receptor")
    assert resp.status_code == 200
    receptor_items = resp.json()["data"]
    assert all(i["entity_type"] == "Receptor" for i in receptor_items)

    # POST /api/v1/curator/targets
    post_payload = {
        "entity_type": "Receptor",
        "slug": "chrm2",
        "label": "Muscarinic Acetylcholine Receptor M2",
        "description": "Cardiac M2 muscarinic receptor",
        "gene_symbol": "CHRM2",
        "family": "G-protein coupled receptor (Gi)",
    }
    resp = await client.post("/api/v1/curator/targets", json=post_payload)
    assert resp.status_code == 201
    created = resp.json()["data"]["entity"]
    assert created["slug"] == "chrm2"
    assert created["entity_type"] == "Receptor"

    # Search for created
    resp = await client.get("/api/v1/curator/targets?search=chrm2")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 1
    assert items[0]["slug"] == "chrm2"
