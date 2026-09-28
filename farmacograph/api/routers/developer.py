"""Developer & Partner API router — B2B HealthTech & EdTech self-service onboarding."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field

from farmacograph.api.deps import get_app_container, get_settings
from farmacograph.auth.models import generate_api_key
from farmacograph.auth.repository import AuthRepository
from farmacograph.core.config import Settings
from farmacograph.core.container import Container

router = APIRouter(prefix="/developer", tags=["Developer Platform & B2B"])


class InstantKeyRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100, description="Developer or application name")
    email: str = Field(max_length=320, description="Contact email address")
    organization: str | None = Field(default=None, max_length=200, description="Company or university")
    intended_use: Literal["education", "research", "healthtech_demo", "student_project", "ai_agent"] = Field(
        description="Primary intended usage"
    )


class EnterpriseInquiryRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    contact_name: str = Field(min_length=2, max_length=100)
    work_email: str = Field(max_length=320)
    use_case: str = Field(min_length=20, max_length=2000, description="EMR, CDSS, simulation, or cohort details")
    estimated_monthly_volume: Literal["<50k", "50k-500k", "500k-5M", "5M+"]
    needs_on_premise: bool = False


@router.get("/tiers")
async def list_api_tiers() -> dict:
    """Return available FarmacoGraph API tiers for healthtech companies and education platforms."""
    tier_list = [
        {
            "tier": "public_explorer",
            "target_audience": "Individual medical students and exploratory web viewers",
            "rate_limit": "60 requests/minute",
            "authentication": "None (IP-based)",
            "scopes": ["knowledge:read", "education:read"],
            "price": "Free",
        },
        {
            "tier": "student_learner",
            "target_audience": "Medical students, residents, and study cohorts",
            "rate_limit": "300 requests/minute",
            "authentication": "Bearer JWT",
            "scopes": ["knowledge:read", "knowledge:search", "knowledge:explain", "education:read"],
            "price": "Free / Academic grant",
        },
        {
            "tier": "developer_researcher",
            "target_audience": "EdTech apps, independent developers, pharmacology researchers",
            "rate_limit": "1,000 requests/minute",
            "authentication": "API Key (fg_live_...)",
            "scopes": ["knowledge:read", "knowledge:search", "knowledge:explain", "education:read"],
            "price": "Self-service / Pay-as-you-grow",
        },
        {
            "tier": "enterprise_clinical",
            "target_audience": "Hospital EHR/EMR systems, clinical decision support (CDSS), simulation platforms",
            "rate_limit": "5,000–50,000 requests/minute",
            "authentication": "Dedicated Enterprise API Key + Optional SSO",
            "scopes": ["All scopes", "knowledge:reasoning", "custom:subgraphs", "export:bulk"],
            "price": "Custom annual contract with SLA and snapshot compliance guarantee",
        },
    ]
    return {
        "data": {"tiers": tier_list},
        "tiers": tier_list,
        "meta": {"api_version": "v1", "license": "GPL-3.0 with Enterprise Dual-Licensing Option"},
    }


@router.post("/instant-key", status_code=201)
async def generate_instant_developer_key(
    body: InstantKeyRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict:
    """Issue a 30-day developer API key for immediate prototyping.

    The key record is persisted to the api_keys table, so the returned
    `api_key` authenticates immediately via X-API-Key / Bearer fg_....
    """
    full_key, prefix, key_hash = generate_api_key(settings)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    scopes = [
        "knowledge:read",
        "knowledge:search",
        "knowledge:explain",
        "education:read",
    ]

    repo = AuthRepository(container.session_factory)
    try:
        record = await repo.create_api_key(
            name=f"instant:{body.name.strip()[:80]}",
            key_prefix=prefix,
            key_hash=key_hash,
            scopes=scopes,
            expires_at=expires_at,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"API key store unavailable, key not issued: {exc}",
        ) from exc

    # Return structured key package so developers can immediately use it in curl or SDKs.
    return {
        "data": {
            "api_key": full_key,
            "key_id": str(record.id),
            "key_prefix": prefix,
            "tier": "developer_researcher",
            "rate_limit": "1,000 requests/minute",
            "scopes": scopes,
            "expires_at": expires_at.isoformat(),
            "documentation_url": "https://farmacograph.furkanguven.space/api/v1/docs",
        },
        "meta": {
            "api_version": "v1",
            "message": "Developer API key generated successfully. Save this key; it will not be shown again in full.",
        },
    }


@router.post("/enterprise-inquiry", status_code=202)
async def submit_enterprise_inquiry(body: EnterpriseInquiryRequest) -> dict:
    """Receive partnership inquiry from clinical software or university enterprise."""
    inquiry_id = str(uuid4())
    return {
        "data": {
            "inquiry_id": inquiry_id,
            "company_name": body.company_name,
            "status": "received",
        },
        "meta": {
            "api_version": "v1",
            "message": "Enterprise inquiry received. A solutions engineer will contact you within 1 business day.",
        },
    }
