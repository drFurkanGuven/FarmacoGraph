"""Search service — Search API product. Provider interface only — no concrete backend."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.models.enums import ContentLayer


@runtime_checkable
class SearchProvider(Protocol):
    """Plugin interface for search backends."""

    async def search(self, query: str, *, limit: int = 20, types: list[str] | None = None) -> list[dict[str, Any]]: ...
    async def autocomplete(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]: ...
    async def health_check(self) -> str: ...


class NullSearchProvider:
    """Default no-op provider until search backend is configured."""

    async def search(self, query: str, *, limit: int = 20, types: list[str] | None = None) -> list[dict[str, Any]]:
        return []

    async def autocomplete(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        return []

    async def health_check(self) -> str:
        return "not_configured"


class SearchService:
    def __init__(self, provider: SearchProvider | None = None) -> None:
        self._provider: SearchProvider = provider or NullSearchProvider()

    def set_provider(self, provider: SearchProvider) -> None:
        self._provider = provider

    async def search(
        self,
        query: str,
        *,
        limit: int = 20,
        types: list[str] | None = None,
    ) -> tuple[list[dict[str, Any]], ResponseMeta]:
        results = await self._provider.search(query, limit=limit, types=types)
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return results, meta

    async def autocomplete(self, query: str, limit: int = 10) -> tuple[list[dict[str, Any]], ResponseMeta]:
        results = await self._provider.autocomplete(query, limit=limit)
        meta = ResponseMeta(
            dataset_version="unpublished",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
        )
        return results, meta
