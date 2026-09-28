"""Mechanism Builder API Router.

Handles saving mechanism diagrams and providing MoA suggestions.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID, uuid5

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container

router = APIRouter(prefix="/mechanisms", tags=["Mechanisms"])

CHEMBL_MOA_DIR = Path(__file__).parents[3] / "staging" / "chembl-moa-imports"
MECHANISM_NAMESPACE = UUID("a1e4c015-0000-4000-8000-000000000000")


class MechanismNode(BaseModel):
    id: str
    type: str  # target, mechanism, effect, outcome, adverse
    label: str
    position: dict[str, float]


class MechanismEdge(BaseModel):
    id: str
    source: str
    target: str


class MechanismSaveRequest(BaseModel):
    drug_name: str
    nodes: list[MechanismNode]
    edges: list[MechanismEdge]
    description: str | None = None


class MechanismSaveResponse(BaseModel):
    success: bool
    mechanism_id: str
    message: str


class MoASuggestion(BaseModel):
    smiles: str
    mechanism_of_action: str
    confidence: float
    source: str


class MoASuggestionsResponse(BaseModel):
    drug_name: str
    suggestions: list[MoASuggestion]


def generate_mechanism_id(drug_name: str) -> str:
    """Generate deterministic UUID for mechanism."""
    return str(uuid5(MECHANISM_NAMESPACE, drug_name.lower().strip()))


def load_chembl_moa_index() -> dict[str, list[dict[str, Any]]]:
    """Load ChEMBL MoA data indexed by mechanism keywords."""
    package_file = CHEMBL_MOA_DIR / "chembl-moa-2023.json"
    if not package_file.exists():
        return {}

    with open(package_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    moa_entries = data.get("moa_entries", [])

    # Index by mechanism keywords
    index: dict[str, list[dict[str, Any]]] = {}
    for entry in moa_entries:
        moa = entry.get("mechanism_of_action", "").lower()
        # Extract keywords
        keywords = moa.replace("inhibitor", "").replace("antagonist", "").replace("agonist", "").split()
        for keyword in keywords:
            if len(keyword) > 3:
                if keyword not in index:
                    index[keyword] = []
                index[keyword].append(entry)

    return index


@router.post("/save")
async def save_mechanism(
    request: MechanismSaveRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> MechanismSaveResponse:
    """Save a mechanism diagram to curator queue."""
    mechanism_id = generate_mechanism_id(request.drug_name)

    session_factory = container.session_factory

    async with session_factory() as session:
        from sqlalchemy import text

        # Check if already exists
        check_sql = text("""
            SELECT id FROM curator_workflows
            WHERE entity_id = :entity_id
        """)

        result = await session.execute(check_sql, {"entity_id": mechanism_id})

        if result.fetchone():
            # Update existing
            update_sql = text("""
                UPDATE curator_workflows
                SET draft_package_json = :draft_package, updated_at = NOW()
                WHERE entity_id = :entity_id
            """)
        else:
            # Insert new
            update_sql = text("""
                INSERT INTO curator_workflows (
                    id, entity_id, entity_type, state, draft_package_json,
                    created_at, updated_at
                ) VALUES (
                    :id, :entity_id, 'MechanismDiagram', 'draft', :draft_package,
                    NOW(), NOW()
                )
            """)

        draft_package = {
            "entity_payload": {
                "id": mechanism_id,
                "drug_name": request.drug_name,
                "description": request.description,
                "nodes": [n.model_dump() for n in request.nodes],
                "edges": [e.model_dump() for e in request.edges],
            },
            "source": "mechanism-builder",
            "created_by": str(auth.user_id) if auth.user_id else None,
        }

        await session.execute(update_sql, {
            "id": mechanism_id,
            "entity_id": mechanism_id,
            "draft_package": json.dumps(draft_package),
        })

        await session.commit()

    return MechanismSaveResponse(
        success=True,
        mechanism_id=mechanism_id,
        message=f"Mechanism for '{request.drug_name}' saved successfully.",
    )


@router.get("/suggestions/{drug_name}")
async def get_moa_suggestions(
    drug_name: str,
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    limit: int = Query(default=10, ge=1, le=50),
) -> MoASuggestionsResponse:
    """Get MoA suggestions from ChEMBL based on drug name keywords."""
    moa_index = load_chembl_moa_index()

    # Extract keywords from drug name
    keywords = drug_name.lower().split()
    suggestions: list[MoASuggestion] = []
    seen_smiles: set[str] = set()

    for keyword in keywords:
        if len(keyword) < 4:
            continue

        # Find matching MoA entries
        matches = moa_index.get(keyword, [])
        for entry in matches[:limit]:
            smiles = entry.get("smiles", "")
            if smiles and smiles not in seen_smiles:
                seen_smiles.add(smiles)
                suggestions.append(
                    MoASuggestion(
                        smiles=smiles,
                        mechanism_of_action=entry.get("mechanism_of_action", ""),
                        confidence=0.7,  # Default confidence
                        source="ChEMBL",
                    )
                )

        if len(suggestions) >= limit:
            break

    # If no keyword matches, return general suggestions
    if not suggestions:
        all_entries = []
        for entries in moa_index.values():
            all_entries.extend(entries)

        for entry in all_entries[:limit]:
            smiles = entry.get("smiles", "")
            if smiles and smiles not in seen_smiles:
                seen_smiles.add(smiles)
                suggestions.append(
                    MoASuggestion(
                        smiles=smiles,
                        mechanism_of_action=entry.get("mechanism_of_action", ""),
                        confidence=0.5,
                        source="ChEMBL",
                    )
                )

    return MoASuggestionsResponse(
        drug_name=drug_name,
        suggestions=suggestions[:limit],
    )


@router.get("/templates")
async def get_mechanism_templates(
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict[str, Any]:
    """Get predefined mechanism templates."""
    templates = {
        "ace-inhibitor": {
            "name": "ACE Inhibitor (e.g., Ramipril)",
            "nodes": [
                {"id": "1", "type": "target", "label": "ACE Enzyme", "position": {"x": 0, "y": 0}},
                {"id": "2", "type": "mechanism", "label": "Enzyme Inhibition", "position": {"x": 250, "y": 0}},
                {"id": "3", "type": "effect", "label": "Angiotensin II Decrease", "position": {"x": 500, "y": 0}},
                {"id": "4", "type": "outcome", "label": "Vasodilation", "position": {"x": 750, "y": -50}},
                {"id": "5", "type": "outcome", "label": "BP Reduction", "position": {"x": 750, "y": 50}},
            ],
            "edges": [
                {"id": "e1-2", "source": "1", "target": "2"},
                {"id": "e2-3", "source": "2", "target": "3"},
                {"id": "e3-4", "source": "3", "target": "4"},
                {"id": "e3-5", "source": "3", "target": "5"},
            ],
        },
        "beta-blocker": {
            "name": "Beta-Blocker (e.g., Metoprolol)",
            "nodes": [
                {"id": "1", "type": "target", "label": "β1-Adrenergic Receptor", "position": {"x": 0, "y": 0}},
                {"id": "2", "type": "mechanism", "label": "Receptor Blockade", "position": {"x": 250, "y": 0}},
                {"id": "3", "type": "effect", "label": "Heart Rate Decrease", "position": {"x": 500, "y": -50}},
                {"id": "4", "type": "effect", "label": "Contractility Decrease", "position": {"x": 500, "y": 50}},
                {"id": "5", "type": "outcome", "label": "Oxygen Demand Reduction", "position": {"x": 750, "y": 0}},
            ],
            "edges": [
                {"id": "e1-2", "source": "1", "target": "2"},
                {"id": "e2-3", "source": "2", "target": "3"},
                {"id": "e2-4", "source": "2", "target": "4"},
                {"id": "e3-5", "source": "3", "target": "5"},
                {"id": "e4-5", "source": "4", "target": "5"},
            ],
        },
        "statin": {
            "name": "Statin (e.g., Atorvastatin)",
            "nodes": [
                {"id": "1", "type": "target", "label": "HMG-CoA Reductase", "position": {"x": 0, "y": 0}},
                {"id": "2", "type": "mechanism", "label": "Enzyme Inhibition", "position": {"x": 250, "y": 0}},
                {"id": "3", "type": "effect", "label": "Cholesterol Synthesis Decrease", "position": {"x": 500, "y": 0}},
                {"id": "4", "type": "outcome", "label": "LDL Reduction", "position": {"x": 750, "y": -50}},
                {"id": "5", "type": "outcome", "label": "Cardiovascular Risk Reduction", "position": {"x": 750, "y": 50}},
            ],
            "edges": [
                {"id": "e1-2", "source": "1", "target": "2"},
                {"id": "e2-3", "source": "2", "target": "3"},
                {"id": "e3-4", "source": "3", "target": "4"},
                {"id": "e3-5", "source": "3", "target": "5"},
            ],
        },
    }

    return {"templates": templates}


# ============================================================================
# Review Workflow Endpoints
# ============================================================================


class MechanismReviewItem(BaseModel):
    id: str
    drug_name: str
    description: str | None
    node_count: int
    edge_count: int
    state: str
    created_at: str | None
    created_by: str | None


class MechanismReviewListResponse(BaseModel):
    items: list[MechanismReviewItem]
    total: int


class MechanismReviewActionRequest(BaseModel):
    action: str  # approve, reject, request_changes
    notes: str | None = None


class MechanismReviewActionResponse(BaseModel):
    success: bool
    message: str


@router.get("/review")
async def list_mechanisms_for_review(
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
    state: str = Query(default="draft"),
) -> MechanismReviewListResponse:
    """List mechanism diagrams pending review."""
    session_factory = container.session_factory
    
    async with session_factory() as session:
        from sqlalchemy import text
        
        result = await session.execute(
            text("""
                SELECT entity_id, draft_package_json, state, created_at, created_by
                FROM curator_workflows
                WHERE entity_type = 'MechanismDiagram' AND state = :state
                ORDER BY created_at DESC
            """),
            {"state": state},
        )
        
        items: list[MechanismReviewItem] = []
        for row in result.fetchall():
            entity_id, draft_package_json, state_val, created_at, created_by = row
            
            try:
                package = json.loads(draft_package_json) if draft_package_json else {}
                payload = package.get("entity_payload", {})
                nodes = payload.get("nodes", [])
                edges = payload.get("edges", [])
                
                items.append(MechanismReviewItem(
                    id=entity_id,
                    drug_name=payload.get("drug_name", "Unknown"),
                    description=payload.get("description"),
                    node_count=len(nodes),
                    edge_count=len(edges),
                    state=state_val,
                    created_at=str(created_at) if created_at else None,
                    created_by=created_by or package.get("created_by"),
                ))
            except Exception:
                continue
        
        return MechanismReviewListResponse(items=items, total=len(items))


@router.get("/review/{mechanism_id}")
async def get_mechanism_detail(
    mechanism_id: str,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Get full mechanism diagram detail for review."""
    session_factory = container.session_factory
    
    async with session_factory() as session:
        from sqlalchemy import text
        
        result = await session.execute(
            text("""
                SELECT entity_id, draft_package_json, state, created_at, updated_at
                FROM curator_workflows
                WHERE entity_id = :entity_id AND entity_type = 'MechanismDiagram'
            """),
            {"entity_id": mechanism_id},
        )
        
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Mechanism not found")
        
        entity_id, draft_package_json, state, created_at, updated_at = row
        
        try:
            package = json.loads(draft_package_json) if draft_package_json else {}
        except Exception:
            package = {}
        
        return {
            "id": entity_id,
            "state": state,
            "created_at": str(created_at) if created_at else None,
            "updated_at": str(updated_at) if updated_at else None,
            "package": package,
        }


@router.post("/review/{mechanism_id}/action")
async def review_mechanism_action(
    mechanism_id: str,
    request: MechanismReviewActionRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:publish"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> MechanismReviewActionResponse:
    """Approve, reject, or request changes for a mechanism diagram."""
    valid_actions = ["approve", "reject", "request_changes"]
    if request.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {valid_actions}")
    
    state_mapping = {
        "approve": "approved",
        "reject": "rejected",
        "request_changes": "changes_requested",
    }
    new_state = state_mapping[request.action]
    
    session_factory = container.session_factory
    
    async with session_factory() as session:
        from sqlalchemy import text
        
        # Check if exists
        check_result = await session.execute(
            text("""
                SELECT id FROM curator_workflows
                WHERE entity_id = :entity_id AND entity_type = 'MechanismDiagram'
            """),
            {"entity_id": mechanism_id},
        )
        
        if not check_result.fetchone():
            raise HTTPException(status_code=404, detail="Mechanism not found")
        
        # Update state
        await session.execute(
            text("""
                UPDATE curator_workflows
                SET state = :new_state, notes = :notes, updated_at = NOW()
                WHERE entity_id = :entity_id
            """),
            {
                "new_state": new_state,
                "notes": request.notes,
                "entity_id": mechanism_id,
            },
        )
        
        await session.commit()
    
    messages = {
        "approve": f"Mechanism '{mechanism_id}' approved successfully.",
        "reject": f"Mechanism '{mechanism_id}' rejected.",
        "request_changes": f"Changes requested for mechanism '{mechanism_id}'.",
    }
    
    return MechanismReviewActionResponse(
        success=True,
        message=messages[request.action],
    )


@router.get("/graph/{drug_name}")
async def get_drug_mechanism_graph(
    drug_name: str,
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Retrieve auto-generated biological mechanism subgraph from Neo4j knowledge graph."""
    graph_repo = getattr(container, "graph_repo", None)
    if graph_repo and hasattr(graph_repo, "get_mechanism_subgraph"):
        return await graph_repo.get_mechanism_subgraph(drug_name)
    return {"nodes": [], "edges": []}
