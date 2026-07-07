"""Curator workflow API — draft → review → approved → published."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.api.schemas.curator import CreateWorkflowRequest, PublishRequest, WorkflowResponse
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.core.exceptions import FarmacoGraphError, NotFoundError, ValidationError
from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.curator.structural_stub import (
    CV_STUB_DRUG_ID,
    build_cardiovascular_publish_package,
)

router = APIRouter(prefix="/curator", tags=["Curator"])


def get_curator_service(container: Annotated[Container, Depends(get_app_container)]):
    return container.curator_service


@router.post("/validate")
async def validate_package(
    body: PublishRequest,
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    """Dry-run validation — no Neo4j write."""
    result = validate_publish_package(
        body.entity_payload,
        related_entities=body.related_entities,
        relationships=body.relationships,
    )
    return {
        "data": {
            "valid": result.valid,
            "issues": [i.model_dump() for i in result.issues],
        },
        "meta": {"api_version": "v1", "error_count": len(result.errors)},
    }


@router.get("/stubs/cardiovascular")
async def get_cardiovascular_stub(
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    """Structural stub template for Phase 4.4 bootstrap — not real pharmacology."""
    package = build_cardiovascular_publish_package()
    return {
        "data": package,
        "meta": {
            "api_version": "v1",
            "entity_id": CV_STUB_DRUG_ID,
            "note": "Structural stub only. Replace before real curation.",
        },
    }


@router.post("/workflows", status_code=201)
async def create_workflow(
    body: CreateWorkflowRequest,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    workflow = await service.create_draft(body.entity_id, body.entity_type, notes=body.notes)
    return {"data": WorkflowResponse.from_model(workflow).model_dump(), "meta": {"api_version": "v1"}}


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    workflow = await service.get_workflow(workflow_id)
    return {"data": WorkflowResponse.from_model(workflow).model_dump(), "meta": {"api_version": "v1"}}


@router.get("/queue")
async def get_review_queue(
    state: str = "review",
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    items = await service.get_queue(state)
    return {
        "data": [WorkflowResponse.from_model(w).model_dump() for w in items],
        "meta": {"api_version": "v1", "count": len(items)},
    }


@router.post("/workflows/{workflow_id}/submit")
async def submit_for_review(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        workflow = await service.submit_for_review(workflow_id)
        return {"data": WorkflowResponse.from_model(workflow).model_dump(), "meta": {"api_version": "v1"}}
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/approve")
async def approve_workflow(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
) -> dict:
    try:
        workflow = await service.approve(workflow_id)
        return {"data": WorkflowResponse.from_model(workflow).model_dump(), "meta": {"api_version": "v1"}}
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/publish")
async def publish_workflow(
    workflow_id: UUID,
    body: PublishRequest,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
) -> dict:
    try:
        workflow = await service.publish(
            workflow_id,
            body.entity_payload,
            dataset_version=body.dataset_version,
            related_entities=body.related_entities,
            relationships=body.relationships,
            module=body.module,
            create_snapshot=body.create_snapshot,
        )
        return {"data": WorkflowResponse.from_model(workflow).model_dump(), "meta": {"api_version": "v1"}}
    except (ValidationError, NotFoundError, FarmacoGraphError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
