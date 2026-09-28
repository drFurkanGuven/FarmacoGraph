"""FDA DDI Import API Router.

Handles importing FDA DDI datasets into the curator queue.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container

router = APIRouter(prefix="/imports", tags=["Imports"])

IMPORT_DIR = Path(__file__).parents[3] / "staging" / "fda-ddi-imports"
CHEMBL_IMPORT_DIR = Path(__file__).parents[3] / "staging" / "chembl-moa-imports"


class ImportPackageMetadata(BaseModel):
    source: str
    doi: str
    version: str
    total_interactions: int
    unique_drugs: int
    severity_counts: dict[str, int]
    synced_at: str | None = None


class InteractionPreview(BaseModel):
    id: str
    drug_a_name: str
    drug_b_name: str
    severity: str
    mechanism_explanation: str
    clinical_action: str
    source: str


class ImportPreviewResponse(BaseModel):
    package_id: str
    metadata: ImportPackageMetadata
    interactions: list[InteractionPreview]


class ImportExecutionResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    error_count: int
    message: str


class ImportStatusResponse(BaseModel):
    package_id: str
    status: str  # pending, importing, completed, error
    metadata: ImportPackageMetadata | None = None
    progress: dict[str, Any] | None = None


@router.get("/available")
async def list_available_imports(
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict[str, Any]:
    """List all available import packages."""
    packages = []

    if not IMPORT_DIR.exists():
        return {"data": {"packages": []}, "meta": {"api_version": "v1"}}

    for json_file in IMPORT_DIR.glob("*.json"):
        if json_file.name.endswith(".status.json"):
            continue
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            metadata = data.get("metadata", {})
            packages.append({
                "id": json_file.stem,
                "name": metadata.get("source", "Unknown"),
                "source": metadata.get("source", "Unknown"),
                "doi": metadata.get("doi", ""),
                "total_interactions": metadata.get("total_interactions", 0),
                "unique_drugs": metadata.get("unique_drugs", 0),
                "severity_counts": metadata.get("severity_counts", {}),
                "synced_at": metadata.get("synced_at"),
                "status": "pending",
            })
        except Exception:
            continue

    return {"data": {"packages": packages}, "meta": {"api_version": "v1"}}


@router.get("/{package_id}/preview")
async def get_import_preview(
    package_id: str,
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    limit: int = Query(default=50, ge=1, le=500),
    severity_filter: str | None = Query(default=None),
) -> dict[str, Any]:
    """Get preview of interactions in an import package."""
    package_file = IMPORT_DIR / f"{package_id}.json"

    if not package_file.exists():
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found")

    try:
        with open(package_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read package: {e}")

    metadata = data.get("metadata", {})
    interactions = data.get("interactions", [])

    # Apply severity filter
    if severity_filter:
        interactions = [i for i in interactions if i.get("severity") == severity_filter]

    # Apply limit
    preview_interactions = [
        {
            "id": i["id"],
            "drug_a_name": i["drug_a_name"],
            "drug_b_name": i["drug_b_name"],
            "severity": i["severity"],
            "mechanism_explanation": i["mechanism_explanation"],
            "clinical_action": i.get("clinical_action", ""),
            "source": i.get("source", ""),
        }
        for i in interactions[:limit]
    ]

    return {
        "data": {
            "package_id": package_id,
            "metadata": metadata,
            "interactions": preview_interactions,
        },
        "meta": {"api_version": "v1"},
    }


@router.post("/{package_id}/execute")
async def execute_import(
    package_id: str,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> ImportExecutionResponse:
    """Execute import - add interactions to curator queue."""
    package_file = IMPORT_DIR / f"{package_id}.json"

    if not package_file.exists():
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found")

    try:
        with open(package_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read package: {e}")

    interactions = data.get("interactions", [])
    unique_interactions = {}
    for item in interactions:
        item_id = item.get("id")
        if item_id and item_id not in unique_interactions:
            unique_interactions[item_id] = item

    imported = 0
    skipped = 0
    errors = 0

    session_factory = container.session_factory
    from sqlalchemy import text
    from uuid import UUID
    from farmacograph.db.postgres.models import CuratorWorkflow

    async with session_factory() as session:
        # Check existing entity_ids in a single fast query
        check_sql = text("SELECT entity_id FROM curator_workflows WHERE entity_type = 'Interaction'")
        result = await session.execute(check_sql)
        existing_ids = {str(row[0]) for row in result.fetchall()}

        to_insert = [
            item for item_id, item in unique_interactions.items()
            if str(item_id) not in existing_ids
        ]
        skipped = len(interactions) - len(to_insert)

        is_pg = session.bind.dialect.name == "postgresql" if session.bind else True
        if is_pg:
            from sqlalchemy.dialects.postgresql import insert as dialect_insert
        else:
            from sqlalchemy.dialects.sqlite import insert as dialect_insert

        BATCH_SIZE = 1000
        for i in range(0, len(to_insert), BATCH_SIZE):
            chunk = to_insert[i : i + BATCH_SIZE]
            batch_params = [
                {
                    "id": UUID(str(interaction["id"])),
                    "entity_id": str(interaction["id"]),
                    "entity_type": "Interaction",
                    "state": "draft",
                    "draft_package_json": {
                        "entity_payload": {
                            "id": str(interaction["id"]),
                            "drug_a_name": interaction.get("drug_a_name", ""),
                            "drug_b_name": interaction.get("drug_b_name", ""),
                            "severity": interaction.get("severity", "moderate"),
                            "title": interaction.get("title", ""),
                            "mechanism_explanation": interaction.get("mechanism_explanation", ""),
                            "clinical_action": interaction.get("clinical_action", ""),
                        },
                        "source": interaction.get("source", "FDA DailyMed 2026"),
                        "source_doi": interaction.get("source_doi"),
                        "import_batch": package_id,
                    },
                }
                for interaction in chunk
            ]
            try:
                stmt = dialect_insert(CuratorWorkflow).values(batch_params).on_conflict_do_nothing(index_elements=["id"])
                await session.execute(stmt)
                imported += len(chunk)
            except Exception as e:
                errors += len(chunk)
                print(f"Error importing batch: {e}")

        await session.commit()

    # Update package status safely (won't crash if staging is mounted :ro)
    from datetime import datetime, timezone
    status_data = {
        "status": "completed" if errors == 0 else "partial",
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "imported_count": imported,
        "skipped_count": skipped,
        "error_count": errors,
        "imported_by": str(auth.user_id) if auth.user_id else None,
    }

    try:
        status_file = IMPORT_DIR / f"{package_id}.status.json"
        with open(status_file, "w") as f:
            json.dump(status_data, f, indent=2)
    except (OSError, PermissionError) as e:
        print(f"Notice: status file could not be written to read-only staging: {e}")

    return {
        "data": {
            "success": errors == 0,
            "imported_count": imported,
            "skipped_count": skipped,
            "error_count": errors,
            "message": f"Imported {imported} interactions to curator queue. {skipped} skipped (existing), {errors} errors.",
        },
        "meta": {"api_version": "v1"},
    }


@router.get("/{package_id}/status")
async def get_import_status(
    package_id: str,
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict[str, Any]:
    """Get import status for a package."""
    package_file = IMPORT_DIR / f"{package_id}.json"
    status_file = IMPORT_DIR / f"{package_id}.status.json"

    if not package_file.exists():
        raise HTTPException(status_code=404, detail=f"Package '{package_id}' not found")

    # Check if status file exists (import was executed)
    if status_file.exists():
        with open(status_file, "r") as f:
            status_data = json.load(f)

        with open(package_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        return {
            "data": {
                "package_id": package_id,
                "status": status_data.get("status", "unknown"),
                "metadata": data.get("metadata", {}),
                "progress": {
                    "imported_at": status_data.get("imported_at"),
                    "imported_count": status_data.get("imported_count"),
                    "skipped_count": status_data.get("skipped_count"),
                    "error_count": status_data.get("error_count"),
                },
            },
            "meta": {"api_version": "v1"},
        }

    # Not yet imported
    with open(package_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    return {
        "data": {
            "package_id": package_id,
            "status": "pending",
            "metadata": data.get("metadata", {}),
        },
        "meta": {"api_version": "v1"},
    }


# ============================================================================
# ChEMBL MoA Endpoints
# ============================================================================


class MoAPreview(BaseModel):
    id: str
    smiles: str
    mechanism_of_action: str
    source: str


class MoAImportPreviewResponse(BaseModel):
    package_id: str
    metadata: dict[str, Any]
    moa_entries: list[MoAPreview]


@router.get("/chembl/preview")
async def get_chembl_moa_preview(
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    """Get preview of ChEMBL MoA entries."""
    package_file = CHEMBL_IMPORT_DIR / "chembl-moa-2023.json"

    if not package_file.exists():
        raise HTTPException(status_code=404, detail="ChEMBL MoA package not found")

    try:
        with open(package_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read package: {e}")

    metadata = data.get("metadata", {})
    moa_entries = data.get("moa_entries", [])

    preview_entries = [
        {
            "id": e["id"],
            "smiles": e["smiles"],
            "mechanism_of_action": e["mechanism_of_action"],
            "source": e.get("source", "ChEMBL"),
        }
        for e in moa_entries[:limit]
    ]

    return {
        "data": {
            "package_id": "chembl-moa-2023",
            "metadata": metadata,
            "moa_entries": preview_entries,
        },
        "meta": {"api_version": "v1"},
    }


@router.post("/chembl/execute")
async def execute_chembl_moa_import(
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Execute ChEMBL MoA import - add to curator queue."""
    package_file = CHEMBL_IMPORT_DIR / "chembl-moa-2023.json"

    if not package_file.exists():
        raise HTTPException(status_code=404, detail="ChEMBL MoA package not found")

    try:
        with open(package_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read package: {e}")

    moa_entries = data.get("moa_entries", [])
    unique_entries = {}
    for entry in moa_entries:
        entry_id = entry.get("id")
        if entry_id and entry_id not in unique_entries:
            unique_entries[entry_id] = entry

    imported = 0
    skipped = 0
    errors = 0

    session_factory = container.session_factory
    from sqlalchemy import text
    from uuid import UUID, uuid5
    from farmacograph.db.postgres.models import CuratorWorkflow

    async with session_factory() as session:
        check_sql = text("SELECT entity_id FROM curator_workflows WHERE entity_type = 'MechanismOfAction'")
        result = await session.execute(check_sql)
        existing_ids = {str(row[0]) for row in result.fetchall()}

        to_insert = [
            entry for entry_id, entry in unique_entries.items()
            if str(entry_id) not in existing_ids
        ]
        skipped = len(moa_entries) - len(to_insert)

        is_pg = session.bind.dialect.name == "postgresql" if session.bind else True
        if is_pg:
            from sqlalchemy.dialects.postgresql import insert as dialect_insert
        else:
            from sqlalchemy.dialects.sqlite import insert as dialect_insert

        BATCH_SIZE = 1000
        for i in range(0, len(to_insert), BATCH_SIZE):
            chunk = to_insert[i : i + BATCH_SIZE]
            batch_params = []
            for entry in chunk:
                raw_id = str(entry["id"])
                try:
                    entry_uuid = UUID(raw_id)
                except ValueError:
                    entry_uuid = uuid5(UUID("fda0dd12-0260-0000-0000-000000000000"), raw_id)
                batch_params.append({
                    "id": entry_uuid,
                    "entity_id": raw_id,
                    "entity_type": "MechanismOfAction",
                    "state": "draft",
                    "draft_package_json": {
                        "entity_payload": {
                            "id": raw_id,
                            "smiles": entry.get("smiles", ""),
                            "mechanism_of_action": entry.get("mechanism_of_action", ""),
                        },
                        "source": entry.get("source", "ChEMBL"),
                        "import_batch": "chembl-moa-2023",
                    },
                })
            try:
                stmt = dialect_insert(CuratorWorkflow).values(batch_params).on_conflict_do_nothing(index_elements=["id"])
                await session.execute(stmt)
                imported += len(chunk)
            except Exception as e:
                errors += len(chunk)
                print(f"Error importing MoA batch: {e}")

        await session.commit()

    # Update status safely
    from datetime import datetime, timezone
    status_data = {
        "status": "completed" if errors == 0 else "partial",
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "imported_count": imported,
        "skipped_count": skipped,
        "error_count": errors,
        "imported_by": str(auth.user_id) if auth.user_id else None,
    }

    try:
        status_file = CHEMBL_IMPORT_DIR / "chembl-moa-2023.status.json"
        with open(status_file, "w") as f:
            json.dump(status_data, f, indent=2)
    except (OSError, PermissionError) as e:
        print(f"Notice: status file could not be written to read-only staging: {e}")

    return {
        "data": {
            "success": errors == 0,
            "imported_count": imported,
            "skipped_count": skipped,
            "error_count": errors,
            "message": f"Imported {imported} MoA entries to curator queue. {skipped} skipped, {errors} errors.",
        },
        "meta": {"api_version": "v1"},
    }
