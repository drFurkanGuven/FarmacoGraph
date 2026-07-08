"""Curator workflow API — draft → review → approved → published."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

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


def get_dashboard_service(container: Annotated[Container, Depends(get_app_container)]):
    return container.dashboard_service


@router.get("/drugs")
async def list_curator_drugs(
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    module: str = Query("cardiovascular"),
    search: str = Query(""),
    status: str | None = Query(None),
    workflow_state: str | None = Query(None),
    sort: str = Query("slug"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    data, total = await service.list_drugs_browser(
        module=module,
        search=search,
        status=status,
        workflow_state=workflow_state,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "count": len(data),
            "total": total,
            "limit": limit,
            "offset": offset,
            "module": module,
        },
    }


@router.post("/drugs/{slug}/workflows", status_code=201)
async def open_drug_workflow(
    slug: str,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    workflow, package = await service.get_or_create_workflow_for_slug(slug, actor_id=auth.user_id)
    return {
        "data": {
            "workflow": WorkflowResponse.from_model(workflow).model_dump(),
            "package": package,
            "validation": service.validate_draft_package(package),
        },
        "meta": {"api_version": "v1", "slug": slug},
    }


@router.get("/drugs/{slug}/package")
async def get_drug_package(
    slug: str,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    package, workflow = await service.get_drug_package(slug)
    return {
        "data": package,
        "meta": {
            "api_version": "v1",
            "slug": slug,
            "workflow_id": str(workflow.id) if workflow else None,
            "validation": service.validate_draft_package(package),
        },
    }


@router.put("/workflows/{workflow_id}/package")
async def save_workflow_package(
    workflow_id: UUID,
    body: PublishRequest,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    package = {
        "entity_payload": body.entity_payload,
        "related_entities": body.related_entities,
        "relationships": body.relationships,
        "dataset_version": body.dataset_version,
        "module": body.module,
        "create_snapshot": body.create_snapshot,
    }
    workflow = await service.save_draft_package(workflow_id, package, actor_id=auth.user_id)
    validation = service.validate_draft_package(package)
    return {
        "data": {
            "workflow": WorkflowResponse.from_model(workflow).model_dump(),
            "validation": validation,
        },
        "meta": {"api_version": "v1"},
    }


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
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    workflow = await service.create_draft(
        body.entity_id, body.entity_type, notes=body.notes, actor_id=auth.user_id
    )
    return {
        "data": WorkflowResponse.from_model(workflow).model_dump(),
        "meta": {"api_version": "v1"},
    }


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    workflow = await service.get_workflow(workflow_id)
    return {
        "data": WorkflowResponse.from_model(workflow).model_dump(),
        "meta": {"api_version": "v1"},
    }


@router.get("/queue")
async def get_review_queue(
    container: Annotated[Container, Depends(get_app_container)],
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    state: str = "review",
    limit: int = Query(50, ge=1, le=100),
) -> dict:
    items = await service.get_queue(state, limit=limit)
    graph = container.graph_repo
    data = []
    for w in items:
        entity = None
        if w.entity_type == "Drug" and graph.is_available:
            entity = await graph.get_drug_summary_by_id(w.entity_id)
        data.append(WorkflowResponse.from_model(w, entity=entity).model_dump())
    return {
        "data": data,
        "meta": {"api_version": "v1", "count": len(data), "state": state},
    }


@router.get("/validation-summary")
async def get_validation_summary(
    service=Depends(get_dashboard_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    data = await service.get_validation_summary()
    return {"data": data, "meta": {"api_version": "v1"}}


@router.post("/workflows/{workflow_id}/submit")
async def submit_for_review(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        workflow = await service.submit_for_review(workflow_id, actor_id=auth.user_id)
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/approve")
async def approve_workflow(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
) -> dict:
    try:
        workflow = await service.approve(workflow_id, actor_id=auth.user_id)
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/publish")
async def publish_workflow(
    workflow_id: UUID,
    body: PublishRequest,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
) -> dict:
    try:
        workflow = await service.publish(
            workflow_id,
            body.entity_payload,
            actor_id=auth.user_id,
            dataset_version=body.dataset_version,
            related_entities=body.related_entities,
            relationships=body.relationships,
            module=body.module,
            create_snapshot=body.create_snapshot,
        )
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError, FarmacoGraphError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
