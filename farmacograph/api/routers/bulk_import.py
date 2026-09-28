"""Bulk Import API Router for CSV/JSON files."""

from __future__ import annotations

import csv
import io
import json
from typing import Annotated, Any
from uuid import UUID, uuid5

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container

router = APIRouter(prefix="/bulk-import", tags=["Bulk Import"])

BULK_IMPORT_NAMESPACE = UUID("b01c1110-0000-4000-8000-000000000000")


def generate_bulk_id(data: dict[str, Any]) -> str:
    """Generate deterministic UUID for bulk import."""
    key = f"{data.get('drug_a', '')}-{data.get('drug_b', '')}-{data.get('interaction', '')}"
    return str(uuid5(BULK_IMPORT_NAMESPACE, key))


class BulkImportPreviewRequest(BaseModel):
    file_type: str  # csv or json
    content: str


class BulkImportItem(BaseModel):
    id: str
    drug_a: str
    drug_b: str
    severity: str
    interaction: str
    valid: bool
    error: str | None = None


class BulkImportPreviewResponse(BaseModel):
    items: list[BulkImportItem]
    total: int
    valid_count: int
    invalid_count: int


class BulkImportExecuteRequest(BaseModel):
    items: list[BulkImportItem]


class BulkImportExecuteResponse(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    error_count: int
    message: str


def validate_interaction_item(item: dict[str, Any]) -> tuple[bool, str | None]:
    """Validate a single interaction item."""
    required_fields = ["drug_a", "drug_b", "severity", "interaction"]
    
    for field in required_fields:
        if not item.get(field):
            return False, f"Missing required field: {field}"
    
    valid_severities = ["contraindicated", "major", "moderate", "minor", "beneficial_synergy"]
    if item.get("severity", "").lower() not in valid_severities:
        return False, f"Invalid severity: {item.get('severity')}. Must be one of: {', '.join(valid_severities)}"
    
    return True, None


def parse_csv_content(content: str) -> list[dict[str, Any]]:
    """Parse CSV content into list of dicts."""
    reader = csv.DictReader(io.StringIO(content))
    return [row for row in reader]


def parse_json_content(content: str) -> list[dict[str, Any]]:
    """Parse JSON content into list of dicts."""
    data = json.loads(content)
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and "items" in data:
        return data["items"]
    else:
        raise ValueError("JSON must be an array or object with 'items' key")


@router.post("/preview")
async def preview_bulk_import(
    request: BulkImportPreviewRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
) -> BulkImportPreviewResponse:
    """Preview bulk import from CSV or JSON content."""
    try:
        if request.file_type.lower() == "csv":
            raw_items = parse_csv_content(request.content)
        elif request.file_type.lower() == "json":
            raw_items = parse_json_content(request.content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use 'csv' or 'json'.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse {request.file_type}: {str(e)}")
    
    items: list[BulkImportItem] = []
    valid_count = 0
    invalid_count = 0
    
    for raw_item in raw_items:
        # Normalize field names (support both snake_case and camelCase)
        normalized = {
            "drug_a": raw_item.get("drug_a") or raw_item.get("drugA") or raw_item.get("drug 1") or "",
            "drug_b": raw_item.get("drug_b") or raw_item.get("drugB") or raw_item.get("drug 2") or "",
            "severity": raw_item.get("severity", "").lower(),
            "interaction": raw_item.get("interaction") or raw_item.get("description") or "",
        }
        
        valid, error = validate_interaction_item(normalized)
        item_id = generate_bulk_id(normalized)
        
        if valid:
            valid_count += 1
        else:
            invalid_count += 1
        
        items.append(BulkImportItem(
            id=item_id,
            drug_a=normalized["drug_a"],
            drug_b=normalized["drug_b"],
            severity=normalized["severity"],
            interaction=normalized["interaction"],
            valid=valid,
            error=error,
        ))
    
    return BulkImportPreviewResponse(
        items=items,
        total=len(items),
        valid_count=valid_count,
        invalid_count=invalid_count,
    )


@router.post("/execute")
async def execute_bulk_import(
    request: BulkImportExecuteRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> BulkImportExecuteResponse:
    """Execute bulk import of validated items."""
    valid_items = [item for item in request.items if item.valid]
    
    if not valid_items:
        return BulkImportExecuteResponse(
            success=False,
            imported_count=0,
            skipped_count=0,
            error_count=0,
            message="No valid items to import.",
        )
    
    session_factory = container.session_factory
    imported = 0
    skipped = 0
    errors = 0
    
    async with session_factory() as session:
        from sqlalchemy import text
        
        for item in valid_items:
            try:
                # Check if already exists
                check_sql = text("""
                    SELECT id FROM curator_workflows
                    WHERE entity_id = :entity_id
                """)
                
                result = await session.execute(check_sql, {"entity_id": item.id})
                
                if result.fetchone():
                    skipped += 1
                    continue
                
                # Create curator workflow entry
                draft_package = {
                    "entity_payload": {
                        "id": item.id,
                        "drug_a_name": item.drug_a,
                        "drug_b_name": item.drug_b,
                        "severity": item.severity,
                        "interaction_description": item.interaction,
                    },
                    "source": "bulk-import",
                    "imported_by": str(auth.user_id) if auth.user_id else None,
                }
                
                insert_sql = text("""
                    INSERT INTO curator_workflows (
                        id, entity_id, entity_type, state, draft_package_json,
                        created_at, updated_at
                    ) VALUES (
                        :id, :entity_id, 'Interaction', 'draft', :draft_package,
                        NOW(), NOW()
                    )
                """)
                
                await session.execute(insert_sql, {
                    "id": item.id,
                    "entity_id": item.id,
                    "draft_package": json.dumps(draft_package),
                })
                
                imported += 1
                
            except Exception as e:
                errors += 1
                print(f"Error importing {item.id}: {e}")
        
        await session.commit()
    
    return BulkImportExecuteResponse(
        success=errors == 0,
        imported_count=imported,
        skipped_count=skipped,
        error_count=errors,
        message=f"Imported {imported} interactions. {skipped} skipped (existing), {errors} errors.",
    )


@router.post("/upload")
async def upload_bulk_import(
    file: UploadFile = File(...),
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))] = None,
) -> dict[str, Any]:
    """Upload CSV or JSON file for bulk import preview."""
    content = await file.read()
    content_str = content.decode("utf-8")
    
    # Determine file type from extension
    filename = file.filename or ""
    if filename.endswith(".csv"):
        file_type = "csv"
    elif filename.endswith(".json"):
        file_type = "json"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .csv or .json")
    
    # Parse and validate
    request = BulkImportPreviewRequest(file_type=file_type, content=content_str)
    
    try:
        if file_type == "csv":
            raw_items = parse_csv_content(content_str)
        else:
            raw_items = parse_json_content(content_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse {file_type}: {str(e)}")
    
    items: list[dict[str, Any]] = []
    valid_count = 0
    invalid_count = 0
    
    for raw_item in raw_items:
        normalized = {
            "drug_a": raw_item.get("drug_a") or raw_item.get("drugA") or raw_item.get("drug 1") or "",
            "drug_b": raw_item.get("drug_b") or raw_item.get("drugB") or raw_item.get("drug 2") or "",
            "severity": raw_item.get("severity", "").lower(),
            "interaction": raw_item.get("interaction") or raw_item.get("description") or "",
        }
        
        valid, error = validate_interaction_item(normalized)
        item_id = generate_bulk_id(normalized)
        
        if valid:
            valid_count += 1
        else:
            invalid_count += 1
        
        items.append({
            "id": item_id,
            "drug_a": normalized["drug_a"],
            "drug_b": normalized["drug_b"],
            "severity": normalized["severity"],
            "interaction": normalized["interaction"],
            "valid": valid,
            "error": error,
        })
    
    return {
        "items": items,
        "total": len(items),
        "valid_count": valid_count,
        "invalid_count": invalid_count,
    }
