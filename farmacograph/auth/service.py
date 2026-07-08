"""Authentication service — token issuance and credential validation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.auth.models import (
    AuthContext,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    decode_token,
    extract_api_key_prefix,
    looks_like_jwt,
    verify_api_key,
    verify_password,
)
from farmacograph.auth.repository import AuthRepository
from farmacograph.core.config import Settings
from farmacograph.db.postgres.models import ApiKey


@dataclass
class TokenBundle:
    access_token: str
    refresh_token: str
    expires_in: int
    scopes: list[str]
    email: str | None = None
    name: str | None = None


class AuthError(Exception):
    def __init__(self, message: str, *, status_code: int = 401) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class AuthService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: Settings,
    ) -> None:
        self._settings = settings
        self._repo = AuthRepository(session_factory)

    def _issue_tokens(
        self,
        subject: str,
        scopes: list[str],
        *,
        email: str | None = None,
        name: str | None = None,
    ) -> TokenBundle:
        access_token = create_access_token(subject, self._settings, scopes=scopes)
        refresh_token = create_refresh_token(subject, self._settings, scopes=scopes)
        return TokenBundle(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self._settings.jwt_expire_minutes * 60,
            scopes=scopes,
            email=email,
            name=name,
        )

    async def login_password(self, email: str, password: str) -> TokenBundle:
        user = await self._repo.get_user_by_email(email)
        if user is None or not user.hashed_password:
            raise AuthError("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            raise AuthError("Invalid email or password")
        scopes = await self._repo.get_user_scopes(user.id)
        if not scopes:
            scopes = ["knowledge:read"]
        return self._issue_tokens(str(user.id), scopes, email=user.email, name=user.full_name)

    async def login_api_key(self, api_key: str) -> TokenBundle:
        context = await self._resolve_api_key(api_key)
        if context is None:
            raise AuthError("Invalid API key")
        email = None
        name = None
        if context.user_id is not None:
            user = await self._repo.get_user_by_id(context.user_id)
            if user:
                email = user.email
                name = user.full_name
        return self._issue_tokens(
            str(context.user_id or context.organization_id or uuid.uuid4()),
            sorted(context.scopes),
            email=email,
            name=name,
        )

    async def refresh(self, refresh_token: str) -> TokenBundle:
        try:
            payload = decode_refresh_token(refresh_token, self._settings)
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Refresh token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthError("Invalid refresh token") from exc

        subject = payload.get("sub")
        if not subject:
            raise AuthError("Invalid refresh token")

        scopes = list(payload.get("scopes") or ["knowledge:read"])
        email = None
        name = None
        try:
            user_id = uuid.UUID(subject)
            user = await self._repo.get_user_by_id(user_id)
            if user:
                email = user.email
                name = user.full_name
                scopes = await self._repo.get_user_scopes(user.id) or scopes
        except ValueError:
            pass

        return self._issue_tokens(subject, scopes, email=email, name=name)

    async def resolve_bearer(self, token: str) -> AuthContext | None:
        if looks_like_jwt(token):
            return self._resolve_jwt(token)
        return await self._resolve_api_key(token)

    async def resolve_api_key_header(self, api_key: str) -> AuthContext | None:
        return await self._resolve_api_key(api_key)

    def _resolve_jwt(self, token: str) -> AuthContext | None:
        try:
            payload = decode_token(token, self._settings, expected_type=None)
            token_type = payload.get("type")
            if token_type not in (None, "access"):
                return None
            user_id = None
            if payload.get("sub"):
                try:
                    user_id = uuid.UUID(str(payload["sub"]))
                except ValueError:
                    user_id = None
            scopes = frozenset(payload.get("scopes") or ["knowledge:read"])
            return AuthContext(
                user_id=user_id,
                scopes=scopes,
                is_authenticated=True,
                auth_method="jwt",
            )
        except jwt.InvalidTokenError:
            return None

    async def _resolve_api_key(self, api_key: str) -> AuthContext | None:
        prefix = extract_api_key_prefix(api_key, self._settings)
        if prefix is None:
            return None
        record = await self._repo.get_api_key_by_prefix(prefix)
        if record is None or not verify_api_key(api_key, record.key_hash):
            return None
        if record.expires_at is not None:
            from datetime import datetime

            try:
                from datetime import UTC
            except ImportError:
                from datetime import timezone

                UTC = timezone.utc  # noqa: UP017

            if record.expires_at <= datetime.now(UTC):
                return None
        await self._repo.touch_api_key_last_used(record.id)
        return self._context_from_api_key(record)

    @staticmethod
    def _context_from_api_key(record: ApiKey) -> AuthContext:
        scopes = frozenset(record.scopes or ["knowledge:read"])
        return AuthContext(
            user_id=record.user_id,
            organization_id=record.organization_id,
            workspace_id=record.workspace_id,
            scopes=scopes,
            is_authenticated=True,
            auth_method="api_key",
        )
