"""JWT secret security regression — reject insecure defaults outside dev/test."""

from __future__ import annotations

import re
import uuid

import pytest

from farmacograph.auth.models import (
    create_access_token,
    decode_access_token,
    ensure_jwt_secret,
)
from farmacograph.core.config import Settings
from tests.auth.helpers import INSECURE_JWT_SECRETS, SETTINGS_INSECURE_JWT_SECRETS


def _deploy_script_marks_insecure(secret: str) -> bool:
    """Mirror scripts/deploy-production.sh is_insecure_jwt()."""
    lower = secret.lower()
    pattern = re.compile(
        r"^(?:$|change-me-in-production.*|dev-only-jwt-secret.*|"
        r"dev-secret-change-in-production.*|test-secret.*|changeme.*)$"
    )
    return bool(pattern.match(lower)) or len(secret) < 32


@pytest.mark.parametrize("secret", SETTINGS_INSECURE_JWT_SECRETS)
def test_production_settings_reject_insecure_jwt_secret(secret: str) -> None:
    with pytest.raises(ValueError, match="FG_JWT_SECRET_KEY"):
        Settings(environment="production", jwt_secret_key=secret)


@pytest.mark.parametrize(
    "secret",
    [
        "change-me-in-production-use-long-random-string",
        "dev-only-jwt-secret-change-in-production",
        "dev-secret-change-in-production-32chars",
        "short",
        "",
    ],
)
def test_deploy_script_classifies_insecure_jwt_values(secret: str) -> None:
    assert _deploy_script_marks_insecure(secret) is True


def test_deploy_script_accepts_long_random_secret() -> None:
    assert _deploy_script_marks_insecure("a" * 64) is False


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
