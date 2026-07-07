"""Curriculum and drug package tests."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from farmacograph.curator.drug_package import (
    CV_TEMPLATE_PATH,
    curriculum_stats,
    load_curriculum,
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
