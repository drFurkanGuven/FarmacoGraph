"""Shared auth test helpers."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.auth.models import create_access_token, generate_api_key, hash_password
from farmacograph.core.config import Settings
from farmacograph.db.postgres.models import ApiKey, User, UserRole

CURATOR_SCOPES = ["curator:write", "curator:publish", "knowledge:read"]
ADMIN_SCOPES = [
    *CURATOR_SCOPES,
    "graph:query",
    "admin:org",
    "admin:api_keys",
]


async def seed_curator_user(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    email: str = "curator@test.local",
    password: str = "test-password-123",
    scopes: list[str] | None = None,
    role: str = "curator",
) -> tuple[User, str]:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Test Curator",
        is_active=True,
        is_superuser=role == "administrator",
    )
    role_row = UserRole(user=user, role=role, scopes=scopes or CURATOR_SCOPES)
    async with session_factory() as session:
        session.add(user)
        session.add(role_row)
        await session.commit()
        await session.refresh(user)
    return user, password


async def seed_admin_user(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    email: str = "admin@test.local",
    password: str = "test-password-123",
) -> tuple[User, str]:
    return await seed_curator_user(
        session_factory,
        email=email,
        password=password,
        scopes=ADMIN_SCOPES,
        role="administrator",
    )


async def seed_api_key(
    session_factory: async_sessionmaker[AsyncSession],
    settings: Settings,
    *,
    scopes: list[str] | None = None,
    user: User | None = None,
) -> tuple[str, ApiKey]:
    full_key, prefix, key_hash = generate_api_key(settings)
    record = ApiKey(
        user_id=user.id if user else None,
        name="test-key",
        key_prefix=prefix,
        key_hash=key_hash,
        scopes=scopes or ["knowledge:read", "curator:write"],
        is_active=True,
    )
    async with session_factory() as session:
        session.add(record)
        await session.commit()
        await session.refresh(record)
    return full_key, record


def bearer_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def curator_token(settings: Settings, user_id: uuid.UUID | None = None) -> str:
    subject = str(user_id or uuid.uuid4())
    return create_access_token(subject, settings, scopes=CURATOR_SCOPES)


def admin_token(settings: Settings, user_id: uuid.UUID | None = None) -> str:
    subject = str(user_id or uuid.uuid4())
    return create_access_token(subject, settings, scopes=ADMIN_SCOPES)


INSECURE_JWT_SECRETS = (
    "change-me-in-production",
    "dev-only-jwt-secret-change-in-production",
    "",
)

SETTINGS_INSECURE_JWT_SECRETS = (
    "change-me-in-production",
    "dev-only-jwt-secret-change-in-production",
)

SECURITY_WORKFLOW_ID = "00000000-0000-4000-8000-000000000099"
TEST_DRUG_SLUG = "cv-structural-stub"


def curator_create_workflow_payload() -> dict[str, str]:
    return {
        "entity_id": "00000000-0000-4000-8000-000000000001",
        "entity_type": "Drug",
    }


def curator_publish_payload() -> dict:
    from farmacograph.curator.structural_stub import build_cardiovascular_publish_package

    return build_cardiovascular_publish_package()
