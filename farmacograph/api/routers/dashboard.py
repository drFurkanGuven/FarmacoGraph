"""Dashboard API — Curation Studio operational overview."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.services.dashboard import DashboardService

router = APIRouter(tags=["Dashboard"])


def get_dashboard_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> DashboardService:
    return container.dashboard_service


@router.get("/dashboard")
async def get_dashboard(
    service: Annotated[DashboardService, Depends(get_dashboard_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))] = None,
    module: str = Query("cardiovascular"),
) -> dict:
    data, meta = await service.get_dashboard(module=module)
    return {"data": data, "meta": meta.model_dump()}


@router.get("/audit-logs")
async def list_audit_logs(
    service: Annotated[DashboardService, Depends(get_dashboard_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    resource_type: str | None = None,
) -> dict:
    data = await service.list_audit_logs(limit=limit, offset=offset, resource_type=resource_type)
    return {"data": data, "meta": {"api_version": "v1", "count": len(data)}}


@router.get("/jobs")
async def list_jobs(
    service: Annotated[DashboardService, Depends(get_dashboard_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = None,
    job_type: str | None = None,
) -> dict:
    data = await service.list_jobs(limit=limit, offset=offset, status=status, job_type=job_type)
    return {"data": data, "meta": {"api_version": "v1", "count": len(data)}}
