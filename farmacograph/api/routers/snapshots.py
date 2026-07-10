"""Snapshots API — read-only knowledge release manifests."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.services.snapshot import SnapshotService

router = APIRouter(tags=["Snapshots"])


def get_snapshot_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> SnapshotService:
    return container.snapshot_service


@router.get("/snapshots")
async def list_snapshots(
    service: Annotated[SnapshotService, Depends(get_snapshot_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
    module: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    data, meta = await service.list_snapshots(limit=limit, offset=offset, module=module)
    return {"data": data, "meta": meta}


@router.get("/snapshots/{version_tag}")
async def get_snapshot(
    version_tag: str,
    service: Annotated[SnapshotService, Depends(get_snapshot_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
) -> dict:
    data = await service.get_snapshot_detail(version_tag)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": f'Snapshot "{version_tag}" was not found.'},
        )
    return {"data": data, "meta": {"api_version": "v1"}}
