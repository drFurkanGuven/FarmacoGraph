"""Auth token endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from farmacograph.api.deps import get_auth_service
from farmacograph.auth.schemas import (
    IntrospectRequest,
    IntrospectResponse,
    RefreshRequest,
    TokenRequest,
    TokenResponse,
)
from farmacograph.auth.service import AuthError, AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/token", response_model=TokenResponse)
async def issue_token(
    body: TokenRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        if body.grant_type == "password":
            if not body.username or not body.password:
                raise HTTPException(status_code=400, detail="username and password are required")
            bundle = await auth_service.login_password(body.username, body.password)
        else:
            if not body.api_key:
                raise HTTPException(status_code=400, detail="api_key is required")
            bundle = await auth_service.login_api_key(body.api_key)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return TokenResponse(
        access_token=bundle.access_token,
        refresh_token=bundle.refresh_token,
        expires_in=bundle.expires_in,
        scopes=bundle.scopes,
        email=bundle.email,
        name=bundle.name,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        bundle = await auth_service.refresh(body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return TokenResponse(
        access_token=bundle.access_token,
        refresh_token=bundle.refresh_token,
        expires_in=bundle.expires_in,
        scopes=bundle.scopes,
        email=bundle.email,
        name=bundle.name,
    )


@router.post("/introspect", response_model=IntrospectResponse)
async def introspect_credentials(
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    body: IntrospectRequest | None = None,
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> IntrospectResponse:
    bearer_token = body.access_token if body else None
    api_key = body.api_key if body else None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token and not bearer_token:
            bearer_token = token

    if x_api_key and not api_key:
        api_key = x_api_key

    if not bearer_token and not api_key:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        result = await auth_service.introspect(bearer_token=bearer_token, api_key=api_key)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return IntrospectResponse(
        active=result.active,
        scopes=result.scopes,
        roles=result.roles,
        user_id=result.user_id,
        organization_id=result.organization_id,
        workspace_id=result.workspace_id,
        token_type=result.token_type,
        auth_method=result.auth_method,
        expires_at=result.expires_at,
        email=result.email,
        name=result.name,
    )
