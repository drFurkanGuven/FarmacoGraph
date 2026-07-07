"""Health router."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from farmacograph.api.deps import get_health_service
from farmacograph.api.schemas.responses import APIResponse
from farmacograph.services.health import HealthService

router = APIRouter(tags=["Health"])


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
