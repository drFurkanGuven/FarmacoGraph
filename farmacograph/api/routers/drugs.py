"""Drugs router — Core API."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_drug_service, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.exceptions import NotFoundError
from farmacograph.services.drugs import DrugService

router = APIRouter(prefix="/drugs", tags=["Drugs"])


@router.get("")
async def list_drugs(
    service: Annotated[DrugService, Depends(get_drug_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    module: str | None = None,
    dataset_version: str | None = Query(None, alias="dataset_version"),
) -> dict:
    data, meta = await service.list_drugs(
        module=module, limit=limit, offset=offset, dataset_version=dataset_version
    )
    return {"data": data, "meta": meta.model_dump()}


@router.get("/{drug_id}")
async def get_drug(
    drug_id: UUID,
    service: Annotated[DrugService, Depends(get_drug_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    dataset_version: str | None = None,
) -> dict:
    try:
        data, meta = await service.get_drug(drug_id, dataset_version)
        return {"data": data, "meta": meta.model_dump()}
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail={"code": exc.code, "message": exc.message}) from exc
