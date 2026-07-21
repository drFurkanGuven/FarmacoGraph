"""Admin user and API key management — gated by admin:org."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime
from typing import Any

try:
    from datetime import UTC
except ImportError:  # Python < 3.11
    from datetime import timezone

    UTC = timezone.utc  # noqa: UP017

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from farmacograph.auth.models import SCOPES, generate_api_key, hash_password
from farmacograph.core.config import Settings
from farmacograph.core.exceptions import NotFoundError, ValidationError
from farmacograph.db.postgres.bootstrap_curator import ADMIN_SCOPES, CURATOR_SCOPES
from farmacograph.db.postgres.models import ApiKey, DemoAccessRequest, User, UserRole

ROLE_PRESETS: dict[str, list[str]] = {
    "viewer": ["knowledge:read", "knowledge:search", "education:read"],
    "curator": list(CURATOR_SCOPES),
    "reviewer": list(CURATOR_SCOPES),
    "administrator": list(ADMIN_SCOPES),
}


def _serialize_demo_request(request: DemoAccessRequest) -> dict[str, Any]:
    return {
        "id": str(request.id),
        "email": request.email,
        "full_name": request.full_name,
        "organization": request.organization,
        "intended_use": request.intended_use,
        "status": request.status,
        "created_at": request.created_at.isoformat() if request.created_at else None,
        "reviewed_at": request.reviewed_at.isoformat() if request.reviewed_at else None,
        "reviewed_by": str(request.reviewed_by) if request.reviewed_by else None,
        "user_id": str(request.user_id) if request.user_id else None,
    }


def scopes_for_role(role: str, scopes: list[str] | None = None) -> list[str]:
    if scopes is not None:
        unknown = sorted(set(scopes) - SCOPES)
        if unknown:
            raise ValidationError(f"Unknown scopes: {', '.join(unknown)}")
        return sorted(set(scopes))
    preset = ROLE_PRESETS.get(role)
    if preset is None:
        raise ValidationError(
            f"Unknown role: {role}. Use one of: {', '.join(sorted(ROLE_PRESETS))}."
        )
    return list(preset)


def _serialize_user(user: User) -> dict[str, Any]:
    roles = list(user.roles or [])
    primary = roles[0] if roles else None
    scopes: set[str] = set()
    role_names: list[str] = []
    for role in roles:
        role_names.append(role.role)
        scopes.update(role.scopes or [])
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "role": primary.role if primary else None,
        "roles": sorted(set(role_names)),
        "scopes": sorted(scopes),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def _serialize_api_key(key: ApiKey) -> dict[str, Any]:
    return {
        "id": str(key.id),
        "name": key.name,
        "key_prefix": key.key_prefix,
        "scopes": list(key.scopes or []),
        "is_active": key.is_active,
        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
        "created_at": key.created_at.isoformat() if key.created_at else None,
        "user_id": str(key.user_id) if key.user_id else None,
    }


class AdminUsersService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: Settings,
    ) -> None:
        self._session_factory = session_factory
        self._settings = settings

    async def list_users(
        self, *, search: str = "", limit: int = 50, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int]:
        needle = search.strip().lower()
        async with self._session_factory() as session:
            stmt = select(User).options(selectinload(User.roles)).order_by(User.email)
            result = await session.execute(stmt)
            users = list(result.scalars().all())
        rows = [_serialize_user(user) for user in users]
        if needle:
            rows = [
                row
                for row in rows
                if needle in row["email"].lower() or needle in (row.get("full_name") or "").lower()
            ]
        total = len(rows)
        return rows[offset : offset + limit], total

    async def request_demo_access(
        self, *, email: str, full_name: str, organization: str | None, intended_use: str
    ) -> dict[str, Any]:
        normalized = email.strip().lower()
        clean_name = full_name.strip()
        clean_use = intended_use.strip()
        if not normalized or "@" not in normalized:
            raise ValidationError("email must be a valid address")
        if len(clean_name) < 2:
            raise ValidationError("full_name is required")
        if len(clean_use) < 10:
            raise ValidationError("intended_use must be at least 10 characters")
        async with self._session_factory() as session:
            existing_user = (
                await session.execute(select(User).where(User.email == normalized))
            ).scalar_one_or_none()
            if existing_user is not None:
                raise ValidationError("An account already exists for this email")
            pending = (
                await session.execute(
                    select(DemoAccessRequest).where(
                        DemoAccessRequest.email == normalized,
                        DemoAccessRequest.status == "pending",
                    )
                )
            ).scalar_one_or_none()
            if pending is not None:
                return _serialize_demo_request(pending)
            request = DemoAccessRequest(
                email=normalized,
                full_name=clean_name,
                organization=(organization or "").strip() or None,
                intended_use=clean_use,
                status="pending",
            )
            session.add(request)
            await session.commit()
            await session.refresh(request)
            return _serialize_demo_request(request)

    async def list_demo_requests(self, *, status: str = "pending") -> list[dict[str, Any]]:
        async with self._session_factory() as session:
            stmt = select(DemoAccessRequest).order_by(DemoAccessRequest.created_at.desc())
            if status:
                stmt = stmt.where(DemoAccessRequest.status == status)
            requests = list((await session.execute(stmt)).scalars().all())
        return [_serialize_demo_request(request) for request in requests]

    async def approve_demo_request(
        self, request_id: uuid.UUID, *, reviewer_id: uuid.UUID
    ) -> dict[str, Any]:
        async with self._session_factory() as session:
            request = await session.get(DemoAccessRequest, request_id)
            if request is None:
                raise NotFoundError(f"Demo access request not found: {request_id}")
            if request.status != "pending":
                raise ValidationError(f"Demo request is already {request.status}")
            if (
                await session.execute(select(User).where(User.email == request.email))
            ).scalar_one_or_none() is not None:
                raise ValidationError("An account already exists for this email")
            temporary_password = secrets.token_urlsafe(16)
            user = User(
                email=request.email,
                hashed_password=hash_password(temporary_password),
                full_name=request.full_name,
                is_active=True,
                is_superuser=False,
            )
            session.add(user)
            await session.flush()
            session.add(UserRole(user=user, role="viewer", scopes=ROLE_PRESETS["viewer"]))
            request.status = "approved"
            request.reviewed_at = datetime.now(UTC)
            request.reviewed_by = reviewer_id
            request.user_id = user.id
            await session.commit()
            await session.refresh(request)
            payload = _serialize_demo_request(request)
            payload["temporary_password"] = temporary_password
            return payload

    async def reject_demo_request(
        self, request_id: uuid.UUID, *, reviewer_id: uuid.UUID
    ) -> dict[str, Any]:
        async with self._session_factory() as session:
            request = await session.get(DemoAccessRequest, request_id)
            if request is None:
                raise NotFoundError(f"Demo access request not found: {request_id}")
            if request.status != "pending":
                raise ValidationError(f"Demo request is already {request.status}")
            request.status = "rejected"
            request.reviewed_at = datetime.now(UTC)
            request.reviewed_by = reviewer_id
            await session.commit()
            await session.refresh(request)
            return _serialize_demo_request(request)

    async def get_user(self, user_id: uuid.UUID) -> dict[str, Any]:
        async with self._session_factory() as session:
            user = await self._get_user(session, user_id)
            return _serialize_user(user)

    async def create_user(
        self,
        *,
        email: str,
        password: str,
        full_name: str | None = None,
        role: str = "curator",
        scopes: list[str] | None = None,
        is_active: bool = True,
    ) -> dict[str, Any]:
        normalized = email.strip().lower()
        if not normalized or "@" not in normalized:
            raise ValidationError("email must be a valid address")
        if len(password) < 12:
            raise ValidationError("password must be at least 12 characters")
        role_name = role.strip() or "curator"
        role_scopes = scopes_for_role(role_name, scopes)

        async with self._session_factory() as session:
            existing = (
                await session.execute(select(User).where(User.email == normalized))
            ).scalar_one_or_none()
            if existing is not None:
                raise ValidationError(f"User already exists: {normalized}")

            user = User(
                email=normalized,
                hashed_password=hash_password(password),
                full_name=(full_name or "").strip() or None,
                is_active=is_active,
                is_superuser=role_name == "administrator",
            )
            session.add(user)
            await session.flush()
            session.add(UserRole(user=user, role=role_name, scopes=role_scopes))
            await session.commit()
            await session.refresh(user)
            user = (
                await session.execute(
                    select(User).options(selectinload(User.roles)).where(User.id == user.id)
                )
            ).scalar_one()
            return _serialize_user(user)

    async def update_user(
        self,
        user_id: uuid.UUID,
        *,
        email: str | None = None,
        full_name: str | None = None,
        password: str | None = None,
        role: str | None = None,
        scopes: list[str] | None = None,
        is_active: bool | None = None,
    ) -> dict[str, Any]:
        if password is not None and len(password) < 12:
            raise ValidationError("password must be at least 12 characters")

        async with self._session_factory() as session:
            user = await self._get_user(session, user_id)

            if email is not None:
                normalized = email.strip().lower()
                if not normalized or "@" not in normalized:
                    raise ValidationError("email must be a valid address")
                clash = (
                    await session.execute(
                        select(User).where(User.email == normalized, User.id != user_id)
                    )
                ).scalar_one_or_none()
                if clash is not None:
                    raise ValidationError(f"User already exists: {normalized}")
                user.email = normalized

            if full_name is not None:
                user.full_name = full_name.strip() or None
            if password is not None:
                user.hashed_password = hash_password(password)
            if is_active is not None:
                user.is_active = is_active

            role_name = role.strip() if isinstance(role, str) and role.strip() else None
            if role_name is not None or scopes is not None:
                current_role = user.roles[0].role if user.roles else "curator"
                effective_role = role_name or current_role
                role_scopes = scopes_for_role(effective_role, scopes)
                user.is_superuser = effective_role == "administrator"
                if not user.roles:
                    session.add(UserRole(user=user, role=effective_role, scopes=role_scopes))
                else:
                    for user_role in user.roles:
                        user_role.role = effective_role
                        user_role.scopes = role_scopes

            await session.commit()
            user = (
                await session.execute(
                    select(User).options(selectinload(User.roles)).where(User.id == user_id)
                )
            ).scalar_one()
            return _serialize_user(user)

    async def list_api_keys(self, user_id: uuid.UUID) -> list[dict[str, Any]]:
        async with self._session_factory() as session:
            await self._get_user(session, user_id)
            result = await session.execute(
                select(ApiKey).where(ApiKey.user_id == user_id).order_by(ApiKey.created_at.desc())
            )
            keys = list(result.scalars().all())
        return [_serialize_api_key(key) for key in keys]

    async def create_api_key(
        self,
        user_id: uuid.UUID,
        *,
        name: str,
        scopes: list[str] | None = None,
        expires_at: datetime | None = None,
    ) -> dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            raise ValidationError("API key name is required")

        async with self._session_factory() as session:
            user = await self._get_user(session, user_id)
            if not user.is_active:
                raise ValidationError("Cannot issue API keys for inactive users")

            user_scopes: set[str] = set()
            for role in user.roles or []:
                user_scopes.update(role.scopes or [])
            key_scopes = scopes_for_role(
                "curator",
                scopes if scopes is not None else sorted(user_scopes) or list(CURATOR_SCOPES),
            )
            # Keys may only grant scopes the user already has (unless admin:org on user).
            if "admin:org" not in user_scopes:
                excess = sorted(set(key_scopes) - user_scopes)
                if excess:
                    raise ValidationError(f"API key scopes exceed user scopes: {', '.join(excess)}")

            full_key, prefix, key_hash = generate_api_key(self._settings)
            record = ApiKey(
                user_id=user.id,
                name=clean_name,
                key_prefix=prefix,
                key_hash=key_hash,
                scopes=key_scopes,
                is_active=True,
                expires_at=expires_at,
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)
            payload = _serialize_api_key(record)
            payload["api_key"] = full_key  # shown once
            return payload

    async def revoke_api_key(self, user_id: uuid.UUID, key_id: uuid.UUID) -> dict[str, Any]:
        async with self._session_factory() as session:
            await self._get_user(session, user_id)
            result = await session.execute(
                select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id)
            )
            record = result.scalar_one_or_none()
            if record is None:
                raise NotFoundError(f"API key not found: {key_id}")
            record.is_active = False
            await session.commit()
            await session.refresh(record)
            return _serialize_api_key(record)

    async def _get_user(self, session: AsyncSession, user_id: uuid.UUID) -> User:
        result = await session.execute(
            select(User).options(selectinload(User.roles)).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError(f"User not found: {user_id}")
        return user
