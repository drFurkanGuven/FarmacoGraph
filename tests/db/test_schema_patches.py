"""Regression: API startup patches draft_package_json on existing tables."""

from __future__ import annotations

import os

import pytest
from sqlalchemy import text

os.environ.setdefault("FG_ENVIRONMENT", "test")
os.environ.setdefault("FG_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("FG_NEO4J_ENABLED", "false")
os.environ.setdefault("FG_JWT_SECRET_KEY", "test-secret-key-32-characters-min")


@pytest.mark.asyncio
async def test_init_db_idempotent_when_draft_package_json_missing():
    from farmacograph.core.config import clear_settings_cache, get_settings
    from farmacograph.db.postgres.session import create_engine, init_db

    clear_settings_cache()
    engine = create_engine(get_settings())

    # Simulate a pre-Sprint-4 curator_workflows table missing draft_package_json.
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE TABLE curator_workflows (
                    id CHAR(36) PRIMARY KEY,
                    entity_id VARCHAR(36) NOT NULL,
                    entity_type VARCHAR(100) NOT NULL,
                    state VARCHAR(20) NOT NULL,
                    notes TEXT
                )
                """
            )
        )

    await init_db(engine)

    async with engine.connect() as conn:
        cols = (await conn.execute(text("PRAGMA table_info(curator_workflows)"))).mappings().all()
        names = {row["name"] for row in cols}
        assert "draft_package_json" in names

    # Second run must remain non-destructive / idempotent.
    await init_db(engine)
    await engine.dispose()
