"""Authentication — JWT and API key support."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

try:
    from datetime import UTC
except ImportError:  # Python < 3.11
    UTC = timezone.utc  # noqa: UP017

import bcrypt
import jwt

from farmacograph.core.config import Settings

INSECURE_JWT_SECRETS = frozenset(
    {
        "",
        "change-me-in-production",
        "dev-only-jwt-secret-change-in-production",
    }
)

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
ANONYMOUS_READ_SCOPES = frozenset(
    {
        "knowledge:read",
        "knowledge:search",
        "knowledge:explain",
        "education:read",
    }
)

# Standard permission scopes
SCOPES = frozenset(
    {
        "knowledge:read",
        "knowledge:search",
        "knowledge:explain",
        "education:read",
        "graph:query",
        "curator:write",
        "curator:publish",
        "admin:org",
        "admin:api_keys",
    }
)


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
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def ensure_jwt_secret(settings: Settings) -> None:
    """Reject default JWT secret outside development/test."""
    if settings.environment in ("development", "test"):
        return
    if settings.jwt_secret_key in INSECURE_JWT_SECRETS:
        msg = "FG_JWT_SECRET_KEY must be set to a secure value in staging/production"
        raise ValueError(msg)


def looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2


def _encode_token(
    subject: str,
    settings: Settings,
    *,
    token_type: str,
    scopes: list[str] | None = None,
    expires_delta: timedelta,
) -> str:
    ensure_jwt_secret(settings)
    expire = datetime.now(UTC) + expires_delta
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(UTC),
        "jti": str(uuid.uuid4()),
        "type": token_type,
        "scopes": scopes or ["knowledge:read"],
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(
    subject: str,
    settings: Settings,
    *,
    scopes: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    return _encode_token(
        subject,
        settings,
        token_type=ACCESS_TOKEN_TYPE,
        scopes=scopes,
        expires_delta=expires_delta or timedelta(minutes=settings.jwt_expire_minutes),
    )


def create_refresh_token(
    subject: str,
    settings: Settings,
    *,
    scopes: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    return _encode_token(
        subject,
        settings,
        token_type=REFRESH_TOKEN_TYPE,
        scopes=scopes,
        expires_delta=expires_delta or timedelta(days=settings.jwt_refresh_expire_days),
    )


def decode_token(token: str, settings: Settings, *, expected_type: str | None = None) -> dict:
    ensure_jwt_secret(settings)
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if expected_type is not None and payload.get("type") != expected_type:
        msg = f"Invalid token type: expected {expected_type}"
        raise jwt.InvalidTokenError(msg)
    return payload


def decode_access_token(token: str, settings: Settings) -> dict:
    return decode_token(token, settings, expected_type=ACCESS_TOKEN_TYPE)


def decode_refresh_token(token: str, settings: Settings) -> dict:
    return decode_token(token, settings, expected_type=REFRESH_TOKEN_TYPE)


def extract_api_key_prefix(api_key: str, settings: Settings) -> str | None:
    """Return stored key_prefix from a full API key string."""
    marker = f"{settings.api_key_prefix}_"
    if not api_key.startswith(marker):
        return None
    rest = api_key[len(marker) :]
    if len(rest) < 9 or rest[8] != "_":
        return None
    return f"{marker}{rest[:8]}"


def generate_api_key(settings: Settings) -> tuple[str, str, str]:
    """Returns (full_key, prefix, hash)."""
    raw = secrets.token_urlsafe(32)
    prefix = f"{settings.api_key_prefix}_{raw[:8]}"
    full_key = f"{prefix}_{raw[8:]}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


def verify_api_key(provided: str, stored_hash: str) -> bool:
    return hashlib.sha256(provided.encode()).hexdigest() == stored_hash
