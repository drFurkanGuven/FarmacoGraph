"""JWT secret security regression — reject insecure defaults outside dev/test."""

from __future__ import annotations

import uuid

import pytest

from farmacograph.auth.models import (
    create_access_token,
    decode_access_token,
    ensure_jwt_secret,
)
from farmacograph.core.config import Settings
from tests.auth.helpers import INSECURE_JWT_SECRETS, SETTINGS_INSECURE_JWT_SECRETS


@pytest.mark.parametrize("secret", SETTINGS_INSECURE_JWT_SECRETS)
def test_production_settings_reject_insecure_jwt_secret(secret: str) -> None:
    with pytest.raises(ValueError, match="FG_JWT_SECRET_KEY"):
        Settings(environment="production", jwt_secret_key=secret)


def test_production_settings_accept_secure_jwt_secret() -> None:
    secure = "production-only-secret-32-chars-min"
    settings = Settings(environment="production", jwt_secret_key=secure)
    assert settings.jwt_secret_key == secure
    assert settings.allow_anonymous_read is False


@pytest.mark.parametrize("secret", INSECURE_JWT_SECRETS)
def test_staging_ensure_jwt_secret_rejects_insecure_defaults(secret: str) -> None:
    settings = Settings(environment="staging", jwt_secret_key=secret)
    with pytest.raises(ValueError, match="FG_JWT_SECRET_KEY"):
        ensure_jwt_secret(settings)


@pytest.mark.parametrize("secret", INSECURE_JWT_SECRETS)
def test_staging_token_encode_rejects_insecure_secret(secret: str) -> None:
    settings = Settings(environment="staging", jwt_secret_key=secret)
    with pytest.raises(ValueError, match="FG_JWT_SECRET_KEY"):
        create_access_token(str(uuid.uuid4()), settings)


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_token_roundtrip_requires_secure_secret_in_non_dev(environment: str) -> None:
    secure = "staging-production-secret-32-chars"
    settings = Settings(environment=environment, jwt_secret_key=secure)
    token = create_access_token(str(uuid.uuid4()), settings, scopes=["curator:write"])
    payload = decode_access_token(token, settings)
    assert "curator:write" in payload["scopes"]
