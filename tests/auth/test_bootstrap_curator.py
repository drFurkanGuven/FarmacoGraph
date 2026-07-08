"""Tests for production curator bootstrap helper."""

from __future__ import annotations

import os

import pytest
import pytest_asyncio
from sqlalchemy import select

from farmacograph.auth.models import verify_password
from farmacograph.core.config import get_settings
from farmacograph.core.container import reset_container
from farmacograph.db.postgres.bootstrap_curator import CURATOR_SCOPES, upsert_curator
from farmacograph.db.postgres.models import User, UserRole
from farmacograph.db.postgres.session import create_session_factory, init_db

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_JWT_SECRET_KEY", "test-secret-key-32-characters-min")


@pytest.fixture(autouse=True)
def _reset():
    reset_container()
    get_settings.cache_clear()
    yield
    reset_container()
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def session_factory():
    settings = get_settings()
    factory, engine = create_session_factory(settings)
    await init_db(engine)
    yield factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_upsert_curator_creates_user_with_scopes(session_factory):
    result = await upsert_curator(
        session_factory,
        email="curator@farmacograph.local",
        password="strong-password-12",
        full_name="Prod Curator",
    )
    assert result["action"] == "created"
    assert result["email"] == "curator@farmacograph.local"
    assert result["scopes"] == CURATOR_SCOPES
    assert "password" not in result

    async with session_factory() as session:
        user = (
            await session.execute(select(User).where(User.email == "curator@farmacograph.local"))
        ).scalar_one()
        assert user.is_active is True
        assert user.full_name == "Prod Curator"
        assert verify_password("strong-password-12", user.hashed_password)
        roles = (
            (await session.execute(select(UserRole).where(UserRole.user_id == user.id)))
            .scalars()
            .all()
        )
        assert len(roles) == 1
        assert roles[0].role == "curator"
        assert roles[0].scopes == CURATOR_SCOPES


@pytest.mark.asyncio
async def test_upsert_curator_is_idempotent_and_resets_password(session_factory):
    await upsert_curator(
        session_factory,
        email="Curator@FarmacoGraph.Local",
        password="original-password-12",
    )
    result = await upsert_curator(
        session_factory,
        email="curator@farmacograph.local",
        password="rotated-password-12",
        full_name="Updated",
    )
    assert result["action"] == "updated"

    async with session_factory() as session:
        user = (
            await session.execute(select(User).where(User.email == "curator@farmacograph.local"))
        ).scalar_one()
        assert user.full_name == "Updated"
        assert verify_password("rotated-password-12", user.hashed_password)
        assert not verify_password("original-password-12", user.hashed_password)


@pytest.mark.asyncio
async def test_upsert_curator_rejects_short_password(session_factory):
    with pytest.raises(ValueError, match="password"):
        await upsert_curator(
            session_factory,
            email="curator@farmacograph.local",
            password="short",
        )
