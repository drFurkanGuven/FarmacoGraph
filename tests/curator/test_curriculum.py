"""Curriculum and drug package tests."""

from __future__ import annotations

import json
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from farmacograph.curator.drug_package import (
    CV_CURRICULUM_PATH,
    CV_TEMPLATE_PATH,
    curriculum_stats,
    init_drug_entry,
    list_pending_drugs,
    load_curriculum,
    mark_curriculum_published,
    validate_package_file,
)
from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.curator.structural_stub import build_cardiovascular_publish_package
from farmacograph.core.container import reset_container

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")


def test_curriculum_loads_slugs():
    curriculum = load_curriculum()
    stats = curriculum_stats(curriculum)
    assert stats["module"] == "cardiovascular"
    assert stats["total_slugs"] == 63
    assert stats["by_status"].get("pending", 0) == 63


def test_list_pending_drugs():
    pending = list_pending_drugs(limit=3)
    assert len(pending) == 3
    assert pending[0]["slug"] == "ramipril"
    assert "package_exists" in pending[0]


def test_init_drug_entry_propranolol(tmp_path, monkeypatch):
    from farmacograph.curator import drug_package as dp

    drugs_dir = tmp_path / "drugs"
    monkeypatch.setattr(dp, "CV_DRUGS_DIR", drugs_dir)
    path = dp.init_drug_entry("propranolol")
    assert path.exists()
    package = json.loads(path.read_text())
    assert package["entity_payload"]["slug"] == "propranolol"
    assert package["entity_payload"]["relationships"]["BELONGS_TO"]


def test_mark_curriculum_published(tmp_path, monkeypatch):
    import shutil

    from farmacograph.curator import drug_package as dp

    curriculum_copy = tmp_path / "curriculum.yaml"
    shutil.copy(CV_CURRICULUM_PATH, curriculum_copy)
    monkeypatch.setattr(dp, "CV_CURRICULUM_PATH", curriculum_copy)

    assert dp.mark_curriculum_published("ramipril") is True
    curriculum = dp.load_curriculum(curriculum_copy)
    found = dp.find_drug_in_curriculum("ramipril", curriculum)
    assert found is not None
    assert found[0]["status"] == "published"
    assert dp.mark_curriculum_published("ramipril") is False


def test_template_fails_validation():
    result = validate_package_file(CV_TEMPLATE_PATH)
    assert result.valid is False


def test_structural_stub_package_validates():
    package = build_cardiovascular_publish_package()
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
    )
    assert result.valid is True


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


@pytest.mark.asyncio
async def test_curriculum_api(client: AsyncClient):
    r = await client.get("/api/v1/modules/cardiovascular/curriculum")
    assert r.status_code == 200
    assert r.json()["data"]["stats"]["total_slugs"] == 63


@pytest.mark.asyncio
async def test_validate_endpoint(client: AsyncClient):
    package = build_cardiovascular_publish_package()
    r = await client.post("/api/v1/curator/validate", json=package)
    assert r.status_code == 200
    assert r.json()["data"]["valid"] is True
