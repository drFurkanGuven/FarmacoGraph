"""Health router."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from farmacograph.api.deps import get_health_service, get_info_service
from farmacograph.services.health import HealthService
from farmacograph.services.info import InfoService

router = APIRouter(tags=["Health"])


@router.get("/info")
async def api_info(
    service: Annotated[InfoService, Depends(get_info_service)],
) -> dict:
    """Public API discovery — auth, versions, documentation links."""
    data = await service.get_info()
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "dataset_version": data.get("dataset_version"),
        },
    }


@router.get("/health")
async def health_check(
    service: Annotated[HealthService, Depends(get_health_service)],
) -> dict:
    data = await service.check()
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "dataset_version": data.get("dataset_version"),
        },
    }
