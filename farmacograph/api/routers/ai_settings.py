"""AI Settings API Router."""

from __future__ import annotations

import base64
import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from farmacograph.api.deps import get_app_container, require_scope
from farmacograph.auth.models import AuthContext
from farmacograph.core.container import Container
from farmacograph.services.ai_provider import AVAILABLE_MODELS, AIProviderConfig, create_provider
from farmacograph.services.ai_content_generator import (
    generate_flashcards,
    generate_quiz,
    generate_clinical_pearls,
)

router = APIRouter(prefix="/ai", tags=["AI"])


def encrypt_api_key(api_key: str) -> str:
    """Simple encryption for API key storage. In production, use proper encryption."""
    secret = os.environ.get("FG_ENCRYPTION_KEY", "farmacograph-dev-key-2026")
    key_bytes = secret.encode()[:32].ljust(32, b"\0")
    encrypted = bytes([ord(c) ^ key_bytes[i % len(key_bytes)] for i, c in enumerate(api_key)])
    return base64.b64encode(encrypted).decode()


def decrypt_api_key(encrypted: str) -> str:
    """Decrypt API key."""
    secret = os.environ.get("FG_ENCRYPTION_KEY", "farmacograph-dev-key-2026")
    key_bytes = secret.encode()[:32].ljust(32, b"\0")
    encrypted_bytes = base64.b64decode(encrypted)
    decrypted = bytes([b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(encrypted_bytes)])
    return decrypted.decode()


class AISettingsRequest(BaseModel):
    provider: str
    api_key: str
    model: str
    base_url: str | None = None


class AISettingsResponse(BaseModel):
    id: str
    provider: str
    model: str
    base_url: str | None
    is_active: bool
    api_key_masked: str


class AIProvidersResponse(BaseModel):
    providers: list[dict[str, Any]]


class AIGenerateRequest(BaseModel):
    prompt: str
    system_prompt: str | None = None
    temperature: float = 0.7
    max_tokens: int = 2000


class AIGenerateResponse(BaseModel):
    content: str
    provider: str
    model: str


@router.get("/providers")
async def list_providers(
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
) -> dict[str, Any]:
    """List available AI providers and models."""
    providers = [
        {
            "id": "openai",
            "name": "OpenAI",
            "description": "GPT-4, GPT-3.5 Turbo",
            "requires_key": True,
            "models": AVAILABLE_MODELS.get("openai", []),
        },
        {
            "id": "anthropic",
            "name": "Anthropic",
            "description": "Claude 3.5, Claude 3",
            "requires_key": True,
            "models": AVAILABLE_MODELS.get("anthropic", []),
        },
        {
            "id": "ollama",
            "name": "Ollama (Local)",
            "description": "Run models locally",
            "requires_key": False,
            "models": AVAILABLE_MODELS.get("ollama", []),
        },
    ]
    return {
        "data": {"providers": providers},
        "meta": {"api_version": "v1"},
    }


@router.get("/settings")
async def get_settings(
    auth: Annotated[AuthContext, Depends(require_scope("knowledge:read"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Get current AI settings for user."""
    if not auth.user_id:
        return {"data": None, "meta": {"api_version": "v1"}}

    session_factory = container.session_factory
    async with session_factory() as session:
        from sqlalchemy import text

        result = await session.execute(
            text("""
                SELECT id, provider, model, base_url, api_key_encrypted, is_active
                FROM ai_settings
                WHERE user_id = :user_id AND is_active = true
                ORDER BY updated_at DESC
                LIMIT 1
            """),
            {"user_id": str(auth.user_id)},
        )
        row = result.fetchone()

        if not row:
            return {"data": None, "meta": {"api_version": "v1"}}

        settings_data = {
            "id": str(row[0]),
            "provider": row[1],
            "model": row[2],
            "base_url": row[3],
            "is_active": row[5],
            "api_key_masked": "••••" + row[4][-4:] if row[4] else "••••",
        }
        return {"data": settings_data, "meta": {"api_version": "v1"}}


@router.post("/settings")
async def save_settings(
    request: AISettingsRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Save AI settings for user."""
    if not auth.user_id:
        raise HTTPException(status_code=400, detail="User ID required")

    encrypted_key = encrypt_api_key(request.api_key)

    session_factory = container.session_factory
    async with session_factory() as session:
        from sqlalchemy import text

        # Deactivate existing settings
        await session.execute(
            text("UPDATE ai_settings SET is_active = false WHERE user_id = :user_id"),
            {"user_id": str(auth.user_id)},
        )

        # Insert new settings
        result = await session.execute(
            text("""
                INSERT INTO ai_settings (id, user_id, provider, api_key_encrypted, model, base_url, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), :user_id, :provider, :api_key, :model, :base_url, true, NOW(), NOW())
                RETURNING id
            """),
            {
                "user_id": str(auth.user_id),
                "provider": request.provider,
                "api_key": encrypted_key,
                "model": request.model,
                "base_url": request.base_url,
            },
        )
        row = result.fetchone()
        await session.commit()

        settings_data = {
            "id": str(row[0]),
            "provider": request.provider,
            "model": request.model,
            "base_url": request.base_url,
            "is_active": True,
            "api_key_masked": "••••" + request.api_key[-4:] if request.api_key else "••••",
        }
        return {"data": settings_data, "meta": {"api_version": "v1"}}


@router.post("/generate")
async def generate_content(
    request: AIGenerateRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Generate content using configured AI provider."""
    if not auth.user_id:
        raise HTTPException(status_code=400, detail="User ID required")

    session_factory = container.session_factory
    async with session_factory() as session:
        from sqlalchemy import text

        result = await session.execute(
            text("""
                SELECT provider, api_key_encrypted, model, base_url
                FROM ai_settings
                WHERE user_id = :user_id AND is_active = true
                LIMIT 1
            """),
            {"user_id": str(auth.user_id)},
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=400,
                detail="AI provider not configured. Please set up AI settings first.",
            )

        provider_name, encrypted_key, model, base_url = row
        api_key = decrypt_api_key(encrypted_key)

        config = AIProviderConfig(
            provider=provider_name,
            api_key=api_key,
            model=model,
            base_url=base_url,
        )

        try:
            provider = create_provider(config)
            content = await provider.generate(
                prompt=request.prompt,
                system_prompt=request.system_prompt,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
            )

            return {
                "data": {
                    "content": content,
                    "provider": provider_name,
                    "model": model,
                },
                "meta": {"api_version": "v1"},
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ============================================================================
# Education Content Generation Endpoints
# ============================================================================


class DrugInfoRequest(BaseModel):
    drug_name: str
    drug_class: str = ""
    mechanism: str = ""
    indications: str = ""
    side_effects: str = ""
    count: int = 5


class FlashcardItem(BaseModel):
    question: str
    answer: str


class FlashcardsResponse(BaseModel):
    drug_name: str
    flashcards: list[FlashcardItem]
    provider: str
    model: str


class QuizOption(BaseModel):
    text: str


class QuizItem(BaseModel):
    question: str
    options: list[str]
    correct_answer: int
    explanation: str


class QuizResponse(BaseModel):
    drug_name: str
    questions: list[QuizItem]
    provider: str
    model: str


class ClinicalPearlItem(BaseModel):
    title: str
    content: str


class ClinicalPearlsResponse(BaseModel):
    drug_name: str
    pearls: list[ClinicalPearlItem]
    provider: str
    model: str


async def get_ai_provider(auth: AuthContext, container: Container):
    """Helper to get configured AI provider."""
    if not auth.user_id:
        raise HTTPException(status_code=400, detail="User ID required")

    session_factory = container.session_factory
    async with session_factory() as session:
        from sqlalchemy import text

        result = await session.execute(
            text("""
                SELECT provider, api_key_encrypted, model, base_url
                FROM ai_settings
                WHERE user_id = :user_id AND is_active = true
                LIMIT 1
            """),
            {"user_id": str(auth.user_id)},
        )
        row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=400,
                detail="AI provider not configured. Please set up AI settings first.",
            )

        provider_name, encrypted_key, model, base_url = row
        api_key = decrypt_api_key(encrypted_key)

        config = AIProviderConfig(
            provider=provider_name,
            api_key=api_key,
            model=model,
            base_url=base_url,
        )

        return create_provider(config), provider_name, model


@router.post("/generate/flashcards")
async def generate_flashcards_endpoint(
    request: DrugInfoRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Generate flashcards for a drug using AI."""
    provider, provider_name, model = await get_ai_provider(auth, container)

    try:
        flashcards = await generate_flashcards(
            provider=provider,
            drug_name=request.drug_name,
            drug_class=request.drug_class,
            mechanism=request.mechanism,
            indications=request.indications,
            count=request.count,
        )

        return {
            "data": {
                "drug_name": request.drug_name,
                "flashcards": [FlashcardItem(**fc).model_dump() for fc in flashcards],
                "provider": provider_name,
                "model": model,
            },
            "meta": {"api_version": "v1"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {str(e)}")


@router.post("/generate/quiz")
async def generate_quiz_endpoint(
    request: DrugInfoRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Generate quiz questions for a drug using AI."""
    provider, provider_name, model = await get_ai_provider(auth, container)

    try:
        questions = await generate_quiz(
            provider=provider,
            drug_name=request.drug_name,
            drug_class=request.drug_class,
            mechanism=request.mechanism,
            indications=request.indications,
            side_effects=request.side_effects,
            count=request.count,
        )

        return {
            "data": {
                "drug_name": request.drug_name,
                "questions": [QuizItem(**q).model_dump() for q in questions],
                "provider": provider_name,
                "model": model,
            },
            "meta": {"api_version": "v1"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@router.post("/generate/clinical-pearls")
async def generate_clinical_pearls_endpoint(
    request: DrugInfoRequest,
    auth: Annotated[AuthContext, Depends(require_scope("curator:write"))],
    container: Annotated[Container, Depends(get_app_container)],
) -> dict[str, Any]:
    """Generate clinical pearls for a drug using AI."""
    provider, provider_name, model = await get_ai_provider(auth, container)

    try:
        pearls = await generate_clinical_pearls(
            provider=provider,
            drug_name=request.drug_name,
            drug_class=request.drug_class,
            mechanism=request.mechanism,
            indications=request.indications,
            count=request.count,
        )

        return {
            "data": {
                "drug_name": request.drug_name,
                "pearls": [ClinicalPearlItem(**p).model_dump() for p in pearls],
                "provider": provider_name,
                "model": model,
            },
            "meta": {"api_version": "v1"},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clinical pearl generation failed: {str(e)}")
