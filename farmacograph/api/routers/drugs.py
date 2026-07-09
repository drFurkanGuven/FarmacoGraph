"""Drugs router — Core API."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_drug_service, get_evidence_service, require_scope
from farmacograph.api.schemas.evidence import AttachDrugEvidenceRequest
from farmacograph.auth.models import AuthContext
from farmacograph.core.exceptions import FarmacoGraphError, NotFoundError
from farmacograph.services.drugs import DrugService
from farmacograph.services.evidence import EvidenceService

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
        raise HTTPException(
            status_code=404, detail={"code": exc.code, "message": exc.message}
        ) from exc


def _evidence_http_error(exc: FarmacoGraphError) -> HTTPException:
    if exc.code == "ENTITY_NOT_FOUND":
        status = 404
    elif exc.code == "SERVICE_UNAVAILABLE":
        status = 503
    else:
        status = 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})


@router.get("/{drug_id}/evidence")
async def list_drug_evidence(
    drug_id: UUID,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    dataset_version: str | None = None,
) -> dict:
    data, meta = await service.list_drug_evidence(drug_id, dataset_version=dataset_version)
    return {"data": data, "meta": meta}


@router.get("/{drug_id}/education")
async def list_drug_education(
    drug_id: UUID,
    service: Annotated[DrugService, Depends(get_drug_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("education:read"))],
    dataset_version: str | None = None,
) -> dict:
    data, meta = await service.get_drug_education(drug_id, dataset_version)
    return {"data": data, "meta": meta.model_dump() | {"count": len(data)}}


@router.get("/{drug_id}/education/flashcards")
async def list_drug_flashcards(
    drug_id: UUID,
    service: Annotated[DrugService, Depends(get_drug_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("education:read"))],
    dataset_version: str | None = None,
) -> dict:
    data, meta = await service.get_drug_flashcards(drug_id, dataset_version)
    return {"data": data, "meta": meta.model_dump() | {"count": len(data)}}


@router.post("/{drug_id}/evidence", status_code=201)
async def attach_evidence_to_drug(
    drug_id: UUID,
    body: AttachDrugEvidenceRequest,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data = await service.attach_to_drug(body.evidence_id, drug_id, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1"}}
    except FarmacoGraphError as exc:
        raise _evidence_http_error(exc) from exc


@router.delete("/{drug_id}/evidence/{evidence_id}")
async def detach_evidence_from_drug(
    drug_id: UUID,
    evidence_id: UUID,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data = await service.detach_from_drug(evidence_id, drug_id, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1"}}
    except FarmacoGraphError as exc:
        raise _evidence_http_error(exc) from exc
