"""Diseases router — catalog reads from shared nodes index."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_disease_service, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.exceptions import NotFoundError
from farmacograph.services.diseases import DiseaseService

router = APIRouter(prefix="/diseases", tags=["Entities"])


@router.get("")
async def list_diseases(
    service: Annotated[DiseaseService, Depends(get_disease_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    search: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    data, meta, total = await service.list_diseases(search=search, limit=limit, offset=offset)
    return {
        "data": [item.model_dump() for item in data],
        "meta": {
            **meta.model_dump(),
            "count": len(data),
            "total": total,
            "limit": limit,
            "offset": offset,
        },
    }


@router.get("/{disease_id}")
async def get_disease(
    disease_id: UUID,
    service: Annotated[DiseaseService, Depends(get_disease_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict:
    try:
        data, meta = await service.get_disease(disease_id)
        return {"data": data, "meta": meta.model_dump()}
    except NotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"code": exc.code, "message": exc.message}
        ) from exc
