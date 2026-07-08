"""FastAPI dependencies — resolves services from DI container."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from farmacograph.auth.middleware import resolve_request_auth
from farmacograph.auth.models import ANONYMOUS_READ_SCOPES, AuthContext
from farmacograph.auth.service import AuthService
from farmacograph.core.config import Settings, get_settings
from farmacograph.core.container import Container, get_container
from farmacograph.services.compare import CompareService
from farmacograph.services.curriculum import CurriculumService
from farmacograph.services.drugs import DrugService
from farmacograph.services.evidence import EvidenceService
from farmacograph.services.explain import ExplainService
from farmacograph.services.health import HealthService
from farmacograph.services.info import InfoService
from farmacograph.services.learning import LearningService
from farmacograph.services.modules import ModuleService
from farmacograph.services.search import SearchService
from farmacograph.services.statistics import StatisticsService


def get_app_container() -> Container:
    return get_container()


def get_auth_service(
    container: Annotated[Container, Depends(get_app_container)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    return AuthService(container.session_factory, settings)


def get_health_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> HealthService:
    return container.health_service


def get_info_service(container: Annotated[Container, Depends(get_app_container)]) -> InfoService:
    return container.info_service


def get_drug_service(container: Annotated[Container, Depends(get_app_container)]) -> DrugService:
    return container.drug_service


def get_evidence_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> EvidenceService:
    return container.evidence_service


def get_explain_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> ExplainService:
    return container.explain_service


def get_compare_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> CompareService:
    return container.compare_service


def get_learning_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> LearningService:
    return container.learning_service


def get_search_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> SearchService:
    return container.search_service


def get_module_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> ModuleService:
    return container.module_service


def get_curriculum_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> CurriculumService:
    return container.curriculum_service


def get_statistics_service(
    container: Annotated[Container, Depends(get_app_container)],
) -> StatisticsService:
    return container.statistics_service


async def get_auth_context(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> AuthContext:
    """Resolve auth from middleware state, Bearer JWT/API key, or X-API-Key header."""
    existing = getattr(request.state, "auth_context", None)
    if isinstance(existing, AuthContext):
        return existing

    auth = await resolve_request_auth(
        request,
        authorization=authorization,
        api_key_header=x_api_key,
    )
    request.state.auth_context = auth
    return auth


def require_scope(scope: str):
    async def _check(
        auth: Annotated[AuthContext, Depends(get_auth_context)],
        settings: Annotated[Settings, Depends(get_settings)],
    ) -> AuthContext:
        if auth.has_scope(scope):
            return auth

        if not auth.is_authenticated:
            if scope in ANONYMOUS_READ_SCOPES and settings.allow_anonymous_read:
                return auth
            raise HTTPException(status_code=401, detail="Authentication required")

        raise HTTPException(status_code=403, detail=f"Missing scope: {scope}")

    return _check
