"""Auth request/response schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TokenRequest(BaseModel):
    grant_type: Literal["password", "api_key"]
    username: str | None = Field(default=None, description="Email for password grant")
    password: str | None = None
    api_key: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    scopes: list[str] = Field(default_factory=list)
    email: str | None = None
    name: str | None = None
