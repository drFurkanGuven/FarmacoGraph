"""FastAPI dependencies — resolves services from DI container."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from farmacograph.auth.models import AuthContext, decode_access_token
from farmacograph.core.config import Settings, get_settings
from farmacograph.core.container import Container, get_container
from farmacograph.services.compare import CompareService
from farmacograph.services.drugs import DrugService
from farmacograph.services.explain import ExplainService
from farmacograph.services.health import HealthService
from farmacograph.services.learning import LearningService
from farmacograph.services.modules import ModuleService
from farmacograph.services.search import SearchService
from farmacograph.services.statistics import StatisticsService


def get_app_container() -> Container:
    return get_container()


def get_health_service(container: Annotated[Container, Depends(get_app_container)]) -> HealthService:
    return container.health_service


def get_drug_service(container: Annotated[Container, Depends(get_app_container)]) -> DrugService:
    return container.drug_service


def get_explain_service(container: Annotated[Container, Depends(get_app_container)]) -> ExplainService:
    return container.explain_service


def get_compare_service(container: Annotated[Container, Depends(get_app_container)]) -> CompareService:
    return container.compare_service


def get_learning_service(container: Annotated[Container, Depends(get_app_container)]) -> LearningService:
    return container.learning_service


def get_search_service(container: Annotated[Container, Depends(get_app_container)]) -> SearchService:
    return container.search_service


def get_module_service(container: Annotated[Container, Depends(get_app_container)]) -> ModuleService:
    return container.module_service


def get_statistics_service(container: Annotated[Container, Depends(get_app_container)]) -> StatisticsService:
    return container.statistics_service


async def get_auth_context(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthContext:
    """Resolve auth from Bearer JWT. API key validation extended in Phase 3.5."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = decode_access_token(token, settings)
            scopes = frozenset(payload.get("scopes", ["knowledge:read"]))
            return AuthContext(
                scopes=scopes,
                is_authenticated=True,
                auth_method="jwt",
            )
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid token") from exc
    return AuthContext()


def require_scope(scope: str):
    async def _check(auth: Annotated[AuthContext, Depends(get_auth_context)]) -> AuthContext:
        if not auth.has_scope(scope) and auth.is_authenticated is False:
            # Anonymous allowed for read scopes in development
            if scope in ("knowledge:read", "knowledge:search", "knowledge:explain", "education:read"):
                return auth
        if auth.is_authenticated and not auth.has_scope(scope):
            raise HTTPException(status_code=403, detail=f"Missing scope: {scope}")
        return auth

    return _check
