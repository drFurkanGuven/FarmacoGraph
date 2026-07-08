"""Evidence router — list, detail, CRUD, and SUPPORTED_BY attachments."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_evidence_service, require_scope
from farmacograph.api.schemas.evidence import (
    AttachAssertionRequest,
    CreateEvidenceRequest,
    UpdateEvidenceRequest,
)
from farmacograph.auth.models import AuthContext
from farmacograph.core.exceptions import FarmacoGraphError, NotFoundError
from farmacograph.services.evidence import EvidenceService

router = APIRouter(prefix="/evidence", tags=["Evidence"])


@router.get("")
async def list_evidence(
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    evidence_type: str | None = None,
    search: str | None = None,
    dataset_version: str | None = Query(None, alias="dataset_version"),
) -> dict:
    data, meta = await service.list_evidence(
        limit=limit,
        offset=offset,
        evidence_type=evidence_type,
        search=search,
        dataset_version=dataset_version,
    )
    return {"data": data, "meta": meta}


@router.get("/{evidence_id}")
async def get_evidence(
    evidence_id: UUID,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    dataset_version: str | None = None,
) -> dict:
    try:
        data, meta = await service.get_evidence(evidence_id, dataset_version)
        return {"data": data, "meta": meta.model_dump()}
    except NotFoundError as exc:
        raise HTTPException(
            status_code=404, detail={"code": exc.code, "message": exc.message}
        ) from exc


@router.post("", status_code=201)
async def create_evidence(
    body: CreateEvidenceRequest,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data, meta = await service.create_evidence(body, actor_id=auth.user_id)
        return {"data": data, "meta": meta.model_dump()}
    except FarmacoGraphError as exc:
        raise _http_error(exc) from exc


@router.patch("/{evidence_id}")
async def update_evidence(
    evidence_id: UUID,
    body: UpdateEvidenceRequest,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data, meta = await service.update_evidence(evidence_id, body, actor_id=auth.user_id)
        return {"data": data, "meta": meta.model_dump()}
    except FarmacoGraphError as exc:
        raise _http_error(exc) from exc


@router.post("/{evidence_id}/drugs/{drug_id}", status_code=201)
async def attach_evidence_to_drug(
    evidence_id: UUID,
    drug_id: UUID,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data = await service.attach_to_drug(evidence_id, drug_id, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1"}}
    except FarmacoGraphError as exc:
        raise _http_error(exc) from exc


@router.delete("/{evidence_id}/drugs/{drug_id}")
async def detach_evidence_from_drug(
    evidence_id: UUID,
    drug_id: UUID,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data = await service.detach_from_drug(evidence_id, drug_id, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1"}}
    except FarmacoGraphError as exc:
        raise _http_error(exc) from exc


@router.post("/{evidence_id}/assertions", status_code=201)
async def attach_evidence_to_assertion(
    evidence_id: UUID,
    body: AttachAssertionRequest,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data = await service.attach_to_assertion(evidence_id, body, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1"}}
    except FarmacoGraphError as exc:
        raise _http_error(exc) from exc


@router.delete("/{evidence_id}/assertions")
async def detach_evidence_from_assertion(
    evidence_id: UUID,
    body: AttachAssertionRequest,
    service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> dict:
    try:
        data = await service.detach_from_assertion(evidence_id, body, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1"}}
    except FarmacoGraphError as exc:
        raise _http_error(exc) from exc


def _http_error(exc: FarmacoGraphError) -> HTTPException:
    if exc.code == "ENTITY_NOT_FOUND":
        status = 404
    elif exc.code == "SERVICE_UNAVAILABLE":
        status = 503
    elif exc.code == "VALIDATION_ERROR":
        status = 400
    else:
        status = 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})
