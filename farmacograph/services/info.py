"""API info service — discovery endpoint for integrators."""

from __future__ import annotations

from typing import Any

from farmacograph.core.config import Settings
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.snapshots import SnapshotRepository


class InfoService:
    def __init__(
        self,
        settings: Settings,
        snapshot_repo: SnapshotRepository,
        graph_repo: GraphRepository,
    ) -> None:
        self._settings = settings
        self._snapshots = snapshot_repo
        self._graph = graph_repo

    async def get_info(self) -> dict[str, Any]:
        snapshot = await self._snapshots.get_latest_published()
        dataset_version = (
            snapshot.version_tag
            if snapshot
            else self._settings.current_dataset_version or "unpublished"
        )
        published_drugs = await self._graph.count_drugs()

        return {
            "name": self._settings.app_name,
            "api_version": self._settings.api_version,
            "ontology_version": self._settings.ontology_version,
            "dataset_version": dataset_version,
            "published_drugs": published_drugs,
            "neo4j": "connected" if self._graph.is_available else "disabled",
            "documentation": {
                "swagger": "/docs",
                "redoc": "/redoc",
                "openapi": "/openapi.json",
                "getting_started": (
                    "https://github.com/drFurkanGuven/FarmacoGraph/blob/main/docs/getting-started.md"
                ),
                "api_roadmap": (
                    "https://github.com/drFurkanGuven/FarmacoGraph/blob/main/docs/api-roadmap.md"
                ),
            },
            "authentication": {
                "methods": ["bearer"],
                "anonymous_read_enabled": self._settings.environment != "production",
                "scopes": sorted(
                    [
                        "knowledge:read",
                        "knowledge:search",
                        "knowledge:explain",
                        "education:read",
                        "curator:write",
                        "curator:publish",
                    ]
                ),
                "api_key": {
                    "self_service": False,
                    "contact": "https://github.com/drFurkanGuven/FarmacoGraph/issues",
                },
            },
            "endpoints": {
                "health": "/api/v1/health",
                "info": "/api/v1/info",
                "drugs": "/api/v1/drugs",
                "search": "/api/v1/search",
                "modules": "/api/v1/modules",
                "studio": "/studio/",
            },
            "studio": {
                "url": "/studio/",
                "description": "Curation Studio — primary knowledge authoring interface",
            },
        }
