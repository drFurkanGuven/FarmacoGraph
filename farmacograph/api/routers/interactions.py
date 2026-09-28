"""Interactions router — Clinical Reasoning and Drug-Drug Interactions API."""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends

from farmacograph.api.deps import get_interaction_service, require_scope
from farmacograph.api.schemas.responses import InteractionRequest
from farmacograph.auth.models import AuthContext
from farmacograph.services.interaction import InteractionService

router = APIRouter(tags=["Interactions"])


@router.post("/interactions")
async def analyze_interactions(
    service: Annotated[InteractionService, Depends(get_interaction_service)],
    _auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    body: Any = Body(...),
) -> dict:
    """Analyze drug combinations for pharmacological interactions, adverse synergism, and beneficial combinations."""
    drug_ids: list[UUID] = []
    slugs: list[str] = []

    if isinstance(body, list):
        for item in body:
            try:
                drug_ids.append(UUID(str(item)))
            except (ValueError, AttributeError):
                slugs.append(str(item))
    elif isinstance(body, dict):
        req = InteractionRequest.model_validate(body)
        drug_ids.extend(req.drug_ids)
        slugs.extend(req.slugs)
        for d in req.drugs:
            if isinstance(d, UUID):
                drug_ids.append(d)
            else:
                try:
                    drug_ids.append(UUID(str(d)))
                except (ValueError, AttributeError):
                    slugs.append(str(d))
    elif isinstance(body, InteractionRequest):
        drug_ids.extend(body.drug_ids)
        slugs.extend(body.slugs)
        for d in body.drugs:
            if isinstance(d, UUID):
                drug_ids.append(d)
            else:
                try:
                    drug_ids.append(UUID(str(d)))
                except (ValueError, AttributeError):
                    slugs.append(str(d))

    data, meta = await service.analyze(drug_ids=drug_ids, slugs=slugs)
    return {"data": data.model_dump(mode="json"), "meta": meta.model_dump(mode="json")}
