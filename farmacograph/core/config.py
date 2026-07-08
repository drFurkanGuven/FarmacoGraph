"""Application configuration via environment variables and YAML defaults."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """FarmacoGraph platform settings. Biomedical knowledge lives in Neo4j only."""

    model_config = SettingsConfigDict(
        env_prefix="FG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = "farmacograph"
    environment: Literal["development", "staging", "production", "test"] = "development"
    debug: bool = False
    api_version: str = "v1"
    ontology_version: str = "1.0.0"

    # PostgreSQL — operational metadata only
    database_url: str = Field(
        default="sqlite+aiosqlite:///./farmacograph_ops.db",
        description="Async SQLAlchemy URL. Use postgresql+asyncpg:// in production.",
    )

    # Neo4j — canonical knowledge graph
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"
    neo4j_database: str = "neo4j"
    neo4j_enabled: bool = False

    # Auth
    jwt_secret_key: str = Field(
        default="dev-only-jwt-secret-change-in-production",
        description="Set FG_JWT_SECRET_KEY in production. Must not use the default.",
    )
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 7
    api_key_prefix: str = "fg"
    allow_anonymous_read: bool = True
    seed_dev_users: bool = True
    seed_curator_email: str = "curator@farmacograph.local"
    seed_curator_password: str = "curator-dev-password"

    # Dataset
    current_dataset_version: str | None = None

    # Rate limits (requests per minute)
    rate_limit_anonymous: int = 30
    rate_limit_authenticated: int = 300
    rate_limit_api_key: int = 1000

    # Observability
    log_level: str = "INFO"
    log_json: bool = True
    metrics_enabled: bool = True

    # Paths
    ontology_dir: Path = PROJECT_ROOT / "ontology"
    openapi_path: Path = PROJECT_ROOT / "openapi" / "openapi.yaml"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> Settings:
        insecure_defaults = {
            "change-me-in-production",
            "dev-only-jwt-secret-change-in-production",
        }
        if self.environment == "production":
            secret = (self.jwt_secret_key or "").strip()
            if not secret or secret in insecure_defaults:
                raise ValueError("FG_JWT_SECRET_KEY must be set to a secure value in production")
        if self.environment == "production":
            object.__setattr__(self, "allow_anonymous_read", False)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    """Clear cached settings — for tests only."""
    get_settings.cache_clear()
