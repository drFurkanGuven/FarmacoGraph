"""Auth token endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from farmacograph.api.deps import get_auth_service
from farmacograph.auth.schemas import RefreshRequest, TokenRequest, TokenResponse
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


@router.post("/introspect")
async def introspect_api_key(
    body: dict,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> dict:
    api_key = body.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="api_key is required")
    try:
        bundle = await auth_service.login_api_key(str(api_key))
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    return {
        "scopes": bundle.scopes,
        "email": bundle.email,
        "name": bundle.name,
    }
