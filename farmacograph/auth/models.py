"""Authentication — JWT and API key support."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from farmacograph.core.config import Settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Standard permission scopes
SCOPES = frozenset({
    "knowledge:read",
    "knowledge:search",
    "knowledge:explain",
    "education:read",
    "graph:query",
    "curator:write",
    "curator:publish",
    "admin:org",
    "admin:api_keys",
})


@dataclass
class AuthContext:
    """Resolved authentication context for a request."""

    user_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    scopes: frozenset[str] = frozenset()
    is_authenticated: bool = False
    auth_method: str = "anonymous"  # anonymous | jwt | api_key

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes or "admin:org" in self.scopes


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str,
    settings: Settings,
    *,
    scopes: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    payload = {
        "sub": subject,
        "exp": expire,
        "scopes": scopes or ["knowledge:read"],
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def generate_api_key(settings: Settings) -> tuple[str, str, str]:
    """Returns (full_key, prefix, hash)."""
    raw = secrets.token_urlsafe(32)
    prefix = f"{settings.api_key_prefix}_{raw[:8]}"
    full_key = f"{prefix}_{raw[8:]}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


def verify_api_key(provided: str, stored_hash: str) -> bool:
    return hashlib.sha256(provided.encode()).hexdigest() == stored_hash
