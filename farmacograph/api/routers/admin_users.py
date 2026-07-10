"""Admin users + API keys — administrator account management."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.core.exceptions import NotFoundError, ValidationError
from farmacograph.services.admin_users import AdminUsersService

router = APIRouter(prefix="/users", tags=["Admin"])


class CreateUserRequest(BaseModel):
    email: str
    password: str = Field(min_length=12)
    full_name: str | None = None
    role: str = "curator"
    scopes: list[str] | None = None
    is_active: bool = True


class UpdateUserRequest(BaseModel):
    email: str | None = None
    password: str | None = Field(default=None, min_length=12)
    full_name: str | None = None
    role: str | None = None
    scopes: list[str] | None = None
    is_active: bool | None = None


class CreateApiKeyRequest(BaseModel):
    name: str
    scopes: list[str] | None = None
    expires_at: datetime | None = None


def get_admin_users_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> AdminUsersService:
    return container.admin_users_service


@router.get("")
async def list_users(
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
    search: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    data, total = await service.list_users(search=search, limit=limit, offset=offset)
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "count": len(data),
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }


@router.post("", status_code=201)
async def create_user(
    body: CreateUserRequest,
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        user = await service.create_user(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            role=body.role,
            scopes=body.scopes,
            is_active=body.is_active,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {"data": user, "meta": {"api_version": "v1"}}


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        user = await service.get_user(user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {"data": user, "meta": {"api_version": "v1"}}


@router.patch("/{user_id}")
async def update_user(
    user_id: UUID,
    body: UpdateUserRequest,
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        user = await service.update_user(
            user_id,
            email=body.email,
            password=body.password,
            full_name=body.full_name,
            role=body.role,
            scopes=body.scopes,
            is_active=body.is_active,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {"data": user, "meta": {"api_version": "v1"}}


@router.get("/{user_id}/api-keys")
async def list_user_api_keys(
    user_id: UUID,
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        keys = await service.list_api_keys(user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {
        "data": keys,
        "meta": {"api_version": "v1", "count": len(keys), "user_id": str(user_id)},
    }


@router.post("/{user_id}/api-keys", status_code=201)
async def create_user_api_key(
    user_id: UUID,
    body: CreateApiKeyRequest,
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        key = await service.create_api_key(
            user_id,
            name=body.name,
            scopes=body.scopes,
            expires_at=body.expires_at,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {"data": key, "meta": {"api_version": "v1", "note": "api_key is shown only once"}}


@router.post("/{user_id}/api-keys/{key_id}/revoke")
async def revoke_user_api_key(
    user_id: UUID,
    key_id: UUID,
    service: Annotated[AdminUsersService, Depends(get_admin_users_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        key = await service.revoke_api_key(user_id, key_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {"data": key, "meta": {"api_version": "v1"}}
