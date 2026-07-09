"""Learning router."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from farmacograph.api.deps import get_learning_service, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.services.learning import LearningService

router = APIRouter(prefix="/drugs", tags=["Learning"])


@router.get("/{drug_slug}/prerequisites")
async def get_prerequisites(
    drug_slug: str,
    service: Annotated[LearningService, Depends(get_learning_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict:
    data, meta = await service.get_prerequisites(drug_slug)
    return {"data": data, "meta": meta.model_dump()}


@router.get("/{drug_ref}/study")
async def get_study_view(
    drug_ref: str,
    service: Annotated[LearningService, Depends(get_learning_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("education:read"))],
) -> dict:
    data, meta = await service.get_study_view(drug_ref)
    return {"data": data, "meta": meta.model_dump()}
