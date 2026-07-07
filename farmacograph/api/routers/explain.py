"""Explain and Compare routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from farmacograph.api.deps import get_compare_service, get_explain_service, require_scope
from farmacograph.api.schemas.responses import CompareRequest
from farmacograph.auth.models import AuthContext
from farmacograph.core.exceptions import NoPathError
from farmacograph.services.compare import CompareService
from farmacograph.services.explain import ExplainService

explain_router = APIRouter(tags=["Explain"])
compare_router = APIRouter(tags=["Explain"])


@explain_router.get("/explain")
async def explain(
    service: Annotated[ExplainService, Depends(get_explain_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:explain"))],
    drug: str = Query(...),
    effect: str | None = None,
    question_type: str = "mechanism",
) -> dict:
    try:
        data, meta = await service.explain(drug, effect, question_type)
        return {"data": data.model_dump(), "meta": meta.model_dump()}
    except NoPathError as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": exc.code, "message": exc.message},
        ) from exc


@compare_router.post("/compare")
async def compare_drugs(
    body: CompareRequest,
    service: Annotated[CompareService, Depends(get_compare_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict:
    data, meta = await service.compare(
        body.drug_ids, body.dimensions, body.include_education
    )
    return {"data": data, "meta": meta.model_dump()}
