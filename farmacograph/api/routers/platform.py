"""Search, modules, statistics routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from farmacograph.api.deps import (
    get_module_service,
    get_search_service,
    get_statistics_service,
    require_scope,
)
from farmacograph.auth.models import AuthContext
from farmacograph.services.modules import ModuleService
from farmacograph.services.search import SearchService
from farmacograph.services.statistics import StatisticsService

search_router = APIRouter(tags=["Search"])
modules_router = APIRouter(tags=["Modules"])
stats_router = APIRouter(tags=["Modules"])


@search_router.get("/search")
async def search(
    service: Annotated[SearchService, Depends(get_search_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:search"))],
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    data, meta = await service.search(q, limit=limit)
    return {"data": data, "meta": meta.model_dump()}


@modules_router.get("/modules")
async def list_modules(
    service: Annotated[ModuleService, Depends(get_module_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict:
    data, meta = await service.list_modules()
    return {"data": data, "meta": meta.model_dump()}


@stats_router.get("/statistics")
async def get_statistics(
    service: Annotated[StatisticsService, Depends(get_statistics_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict:
    data, meta = await service.get_statistics()
    return {"data": data, "meta": meta.model_dump()}
