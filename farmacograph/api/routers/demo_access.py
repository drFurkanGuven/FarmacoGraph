"""Public demo access requests and administrator review endpoints."""

from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.core.exceptions import NotFoundError, ValidationError
from farmacograph.services.admin_users import AdminUsersService

router = APIRouter(prefix="/demo-requests", tags=["Demo Access"])


class DemoAccessRequestBody(BaseModel):
    email: str = Field(max_length=320)
    full_name: str = Field(min_length=2, max_length=255)
    organization: str | None = Field(default=None, max_length=255)
    intended_use: str = Field(min_length=10, max_length=2000)
    website: str = Field(default="", max_length=0)  # honeypot


def get_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> AdminUsersService:
    return container.admin_users_service


@router.post("", status_code=202)
async def create_demo_request(
    body: DemoAccessRequestBody,
    service: Annotated[AdminUsersService, Depends(get_service)],
) -> dict:
    try:
        request = await service.request_demo_access(
            email=body.email,
            full_name=body.full_name,
            organization=body.organization,
            intended_use=body.intended_use,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {
        "data": {"id": request["id"], "status": request["status"]},
        "meta": {"api_version": "v1", "message": "Demo request received"},
    }


@router.get("")
async def list_demo_requests(
    service: Annotated[AdminUsersService, Depends(get_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
    status: Literal["pending", "approved", "rejected"] | None = Query("pending"),
) -> dict:
    rows = await service.list_demo_requests(status=status or "")
    return {"data": rows, "meta": {"api_version": "v1", "count": len(rows)}}


@router.post("/{request_id}/approve")
async def approve_demo_request(
    request_id: UUID,
    service: Annotated[AdminUsersService, Depends(get_service)],
    auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        row = await service.approve_demo_request(request_id, reviewer_id=auth.user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {
        "data": row,
        "meta": {"api_version": "v1", "note": "temporary_password is shown only once"},
    }


@router.post("/{request_id}/reject")
async def reject_demo_request(
    request_id: UUID,
    service: Annotated[AdminUsersService, Depends(get_service)],
    auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    try:
        row = await service.reject_demo_request(request_id, reviewer_id=auth.user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {"data": row, "meta": {"api_version": "v1"}}
