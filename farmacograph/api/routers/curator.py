"""Curator workflow API — draft → review → approved → published."""

from __future__ import annotations

from contextlib import suppress
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_app_container, get_evidence_service, require_scope
from farmacograph.api.schemas.curator import (
    CreateDiseaseRequest,
    CreateMechanismFragmentRequest,
    CreateWorkflowRequest,
    DrugWorkflowStateResponse,
    EntityWorkflowStateResponse,
    PublishRequest,
    RejectUnpublishRequestBody,
    UnpublishRequestBody,
    WorkflowResponse,
)
from farmacograph.api.schemas.evidence import AttachDrugEvidenceRequest
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.core.exceptions import FarmacoGraphError, NotFoundError, ValidationError
from farmacograph.curator.drug_package import drug_entity_id
from farmacograph.curator.education_graph import normalize_education_graph
from farmacograph.curator.publish_validator import validate_publish_package
from farmacograph.curator.structural_stub import (
    CV_STUB_DRUG_ID,
    build_cardiovascular_publish_package,
)
from farmacograph.services.evidence import EvidenceService

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


@router.get("/diseases")
async def list_curator_diseases(
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    search: str = Query(""),
    status: str | None = Query(None),
    workflow_state: str | None = Query(None),
    sort: str = Query("slug"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    data, total = await service.list_diseases_browser(
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
        },
    }


@router.post("/diseases", status_code=201)
async def create_disease(
    body: CreateDiseaseRequest,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        entity, workflow, package = await service.create_disease(
            slug=body.slug,
            label=body.label,
            description=body.description,
            icd10=body.icd10,
            mesh=body.mesh,
            actor_id=auth.user_id,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {
        "data": {
            "entity": entity,
            "workflow": WorkflowResponse.from_model(workflow).model_dump(),
            "package": package,
            "validation": service.validate_draft_package(package),
        },
        "meta": {"api_version": "v1", "slug": entity["slug"]},
    }


@router.get("/mechanism-fragments")
async def list_curator_mechanism_fragments(
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    search: str = Query(""),
    sort: str = Query("slug"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> dict:
    data, total = await service.list_mechanism_fragments_browser(
        search=search,
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
        },
    }


@router.post("/mechanism-fragments", status_code=201)
async def create_mechanism_fragment(
    body: CreateMechanismFragmentRequest,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        entity = await service.create_mechanism_fragment(
            slug=body.slug,
            label=body.label,
            description=body.description,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
    return {
        "data": {"entity": entity},
        "meta": {"api_version": "v1", "slug": entity["slug"]},
    }


@router.post("/diseases/{slug}/workflows", status_code=201)
async def open_disease_workflow(
    slug: str,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        workflow, package = await service.get_or_create_workflow_for_disease_slug(
            slug, actor_id=auth.user_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {
        "data": {
            "workflow": WorkflowResponse.from_model(workflow).model_dump(),
            "package": package,
            "validation": service.validate_draft_package(package),
        },
        "meta": {"api_version": "v1", "slug": slug},
    }


@router.get("/diseases/{slug}/package")
async def get_disease_package(
    slug: str,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        package, workflow = await service.get_disease_package(slug)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {
        "data": package,
        "meta": {
            "api_version": "v1",
            "slug": slug,
            "workflow_id": str(workflow.id) if workflow else None,
            "validation": service.validate_draft_package(package),
        },
    }


@router.get("/diseases/{slug}/workflow-state")
async def get_disease_workflow_state(
    slug: str,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    try:
        state = await service.get_disease_workflow_state(slug)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {
        "data": EntityWorkflowStateResponse.model_validate(state).model_dump(),
        "meta": {"api_version": "v1", "slug": slug},
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


@router.get("/drugs/{slug}/workflow-state")
async def get_drug_workflow_state(
    slug: str,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    state = await service.get_drug_workflow_state(slug)
    return {
        "data": DrugWorkflowStateResponse.model_validate(state).model_dump(),
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


@router.get("/drugs/{slug}/evidence")
async def list_curator_drug_evidence(
    slug: str,
    evidence_service: Annotated[EvidenceService, Depends(get_evidence_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    drug_id = UUID(drug_entity_id(slug))
    data, meta = await evidence_service.list_drug_evidence(drug_id)
    meta["slug"] = slug
    return {"data": data, "meta": meta}


@router.post("/drugs/{slug}/evidence", status_code=201)
async def attach_curator_drug_evidence(
    slug: str,
    body: AttachDrugEvidenceRequest,
    evidence_service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    drug_id = UUID(drug_entity_id(slug))
    try:
        data = await evidence_service.attach_to_drug(
            body.evidence_id, drug_id, actor_id=auth.user_id
        )
        return {"data": data, "meta": {"api_version": "v1", "slug": slug}}
    except FarmacoGraphError as exc:
        raise _curator_evidence_error(exc) from exc


@router.delete("/drugs/{slug}/evidence/{evidence_id}")
async def detach_curator_drug_evidence(
    slug: str,
    evidence_id: UUID,
    evidence_service: Annotated[EvidenceService, Depends(get_evidence_service)],
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    drug_id = UUID(drug_entity_id(slug))
    try:
        data = await evidence_service.detach_from_drug(evidence_id, drug_id, actor_id=auth.user_id)
        return {"data": data, "meta": {"api_version": "v1", "slug": slug}}
    except FarmacoGraphError as exc:
        raise _curator_evidence_error(exc) from exc


def _curator_evidence_error(exc: FarmacoGraphError) -> HTTPException:
    if exc.code == "ENTITY_NOT_FOUND":
        status = 404
    elif exc.code == "SERVICE_UNAVAILABLE":
        status = 503
    else:
        status = 400
    return HTTPException(status_code=status, detail={"code": exc.code, "message": exc.message})


@router.get("/drugs/{slug}/education")
async def list_curator_drug_education(
    slug: str,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    data, workflow = await service.get_drug_education(slug)
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "count": len(data),
            "slug": slug,
            "workflow_id": str(workflow.id) if workflow else None,
            "content_layers": ["education"],
        },
    }


@router.get("/drugs/{slug}/education/flashcards")
async def list_curator_drug_flashcards(
    slug: str,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    data, workflow = await service.get_drug_flashcards(slug)
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "count": len(data),
            "slug": slug,
            "workflow_id": str(workflow.id) if workflow else None,
            "content_layers": ["education"],
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
        "education": body.education,
        "dataset_version": body.dataset_version,
        "module": body.module,
        "create_snapshot": body.create_snapshot,
    }
    try:
        workflow = await service.save_draft_package(workflow_id, package, actor_id=auth.user_id)
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc
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
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    workflow_id: UUID | None = Query(None),
) -> dict:
    """Dry-run validation — no Neo4j write."""
    package = normalize_education_graph(
        {
            "entity_payload": body.entity_payload,
            "related_entities": body.related_entities,
            "relationships": body.relationships,
            "education": body.education,
        }
    )
    result = validate_publish_package(
        package["entity_payload"],
        related_entities=package["related_entities"],
        relationships=package["relationships"],
        education=package["education"],
    )
    validation = {
        "valid": result.valid,
        "error_count": len(result.errors),
        "warning_count": max(0, len(result.issues) - len(result.errors)),
    }
    if workflow_id is not None:
        with suppress(NotFoundError):
            await service.log_validation_run(
                workflow_id,
                validation,
                actor_id=auth.user_id,
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


@router.get("/workflows/{workflow_id}/timeline")
async def get_workflow_timeline(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    try:
        data = await service.get_workflow_timeline(workflow_id, limit=limit, offset=offset)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message) from exc
    return {
        "data": data,
        "meta": {
            "api_version": "v1",
            "count": len(data),
            "workflow_id": str(workflow_id),
            "limit": limit,
            "offset": offset,
        },
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


@router.get("/unpublish-requests")
async def list_unpublish_requests(
    container: Annotated[Container, Depends(get_app_container)],
    service=Depends(get_curator_service),
    _auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
    limit: int = Query(50, ge=1, le=100),
) -> dict:
    """Admin inbox: published workflows with a pending unpublish request."""
    items = await service.get_unpublish_requests(limit=limit)
    graph = container.graph_repo
    data = []
    for w in items:
        entity = None
        if w.entity_type == "Drug" and graph.is_available:
            entity = await graph.get_drug_summary_by_id(w.entity_id)
        data.append(WorkflowResponse.from_model(w, entity=entity).model_dump())
    return {
        "data": data,
        "meta": {"api_version": "v1", "count": len(data)},
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


@router.post("/workflows/{workflow_id}/request-unpublish")
async def request_unpublish(
    workflow_id: UUID,
    body: UnpublishRequestBody,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    """Curator requests admin unpublish; workflow stays published until approved."""
    if auth.user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        workflow = await service.request_unpublish(
            workflow_id,
            actor_id=auth.user_id,
            notes=body.notes,
        )
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/cancel-unpublish-request")
async def cancel_unpublish_request(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict:
    """Requester or admin cancels a pending unpublish request."""
    if auth.user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        workflow = await service.cancel_unpublish_request(
            workflow_id,
            actor_id=auth.user_id,
            allow_admin=auth.has_scope("admin:org"),
        )
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/reject-unpublish-request")
async def reject_unpublish_request(
    workflow_id: UUID,
    body: RejectUnpublishRequestBody,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    """Admin rejects a pending unpublish request without unpublishing."""
    if auth.user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        workflow = await service.reject_unpublish_request(
            workflow_id,
            actor_id=auth.user_id,
            notes=body.notes,
        )
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/return-to-draft")
async def return_workflow_to_draft(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))] = None,
) -> dict:
    """approved/review → draft (publisher).

    published → draft requires admin:org (unpublish).
    deprecated → draft requires admin:org (restore).
    """
    try:
        current = await service.get_workflow(workflow_id)
        allow_published = False
        allow_deprecated = False
        if current.state == "published":
            if not auth.has_scope("admin:org"):
                raise HTTPException(
                    status_code=403,
                    detail="Unpublishing a published workflow requires admin:org",
                )
            allow_published = True
        elif current.state == "deprecated":
            if not auth.has_scope("admin:org"):
                raise HTTPException(
                    status_code=403,
                    detail="Restoring a deprecated workflow requires admin:org",
                )
            allow_deprecated = True
        workflow = await service.return_to_draft(
            workflow_id,
            actor_id=auth.user_id,
            allow_published=allow_published,
            allow_deprecated=allow_deprecated,
        )
        return {
            "data": WorkflowResponse.from_model(workflow).model_dump(),
            "meta": {"api_version": "v1"},
        }
    except HTTPException:
        raise
    except (ValidationError, NotFoundError) as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc


@router.post("/workflows/{workflow_id}/deprecate")
async def deprecate_workflow(
    workflow_id: UUID,
    service=Depends(get_curator_service),
    auth: Annotated[AuthContext, Depends(require_scope("admin:org"))] = None,
) -> dict:
    """Soft-delete: published → deprecated (admin only). Hides entity from public graph reads."""
    try:
        workflow = await service.deprecate(workflow_id, actor_id=auth.user_id)
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
    package = {
        "entity_payload": body.entity_payload,
        "related_entities": body.related_entities,
        "relationships": body.relationships,
        "education": body.education,
        "dataset_version": body.dataset_version,
        "module": body.module,
        "create_snapshot": body.create_snapshot,
    }
    try:
        workflow = await service.publish(
            workflow_id,
            body.entity_payload,
            actor_id=auth.user_id,
            dataset_version=body.dataset_version,
            related_entities=body.related_entities,
            relationships=body.relationships,
            education=body.education,
            module=body.module,
            create_snapshot=body.create_snapshot,
        )
        extras = await service.build_publish_result_async(workflow, package)
        return {
            "data": {
                "workflow": WorkflowResponse.from_model(workflow).model_dump(),
                **extras,
            },
            "meta": {"api_version": "v1"},
        }
    except (ValidationError, NotFoundError, FarmacoGraphError) as exc:
        await service.log_publish_failure(workflow_id, exc.message, actor_id=auth.user_id)
        raise HTTPException(status_code=400, detail=exc.message) from exc
