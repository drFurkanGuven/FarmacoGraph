"""Dependency injection container — wires repositories and services."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from farmacograph.core.config import Settings, clear_settings_cache, get_settings
from farmacograph.db.neo4j.driver import Neo4jDriver
from farmacograph.db.postgres.session import create_session_factory
from farmacograph.events.bus import EventBus
from farmacograph.repositories.audit import AuditRepository
from farmacograph.repositories.curator import CuratorRepository
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.graph_writer import GraphWriter
from farmacograph.repositories.jobs import JobRepository
from farmacograph.repositories.outbox import OutboxRepository
from farmacograph.repositories.snapshots import SnapshotRepository
from farmacograph.services.compare import CompareService
from farmacograph.services.curator import CuratorService
from farmacograph.services.drugs import DrugService
from farmacograph.services.explain import ExplainService
from farmacograph.services.health import HealthService
from farmacograph.services.learning import LearningService
from farmacograph.services.modules import ModuleService
from farmacograph.services.reasoning import ReasoningService
from farmacograph.services.search import SearchService
from farmacograph.services.statistics import StatisticsService


@dataclass
class Container:
    """Application DI container. API layer depends on services only."""

    settings: Settings = field(default_factory=get_settings)
    session_factory: async_sessionmaker[AsyncSession] = field(init=False)
    _engine: Any = field(init=False, repr=False)
    neo4j: Neo4jDriver = field(init=False)
    event_bus: EventBus = field(init=False)

    # Repositories
    graph_repo: GraphRepository = field(init=False)
    snapshot_repo: SnapshotRepository = field(init=False)
    job_repo: JobRepository = field(init=False)
    outbox_repo: OutboxRepository = field(init=False)
    audit_repo: AuditRepository = field(init=False)
    curator_repo: CuratorRepository = field(init=False)
    graph_writer: GraphWriter = field(init=False)

    # Services
    health_service: HealthService = field(init=False)
    drug_service: DrugService = field(init=False)
    explain_service: ExplainService = field(init=False)
    compare_service: CompareService = field(init=False)
    learning_service: LearningService = field(init=False)
    reasoning_service: ReasoningService = field(init=False)
    search_service: SearchService = field(init=False)
    module_service: ModuleService = field(init=False)
    statistics_service: StatisticsService = field(init=False)
    curator_service: CuratorService = field(init=False)

    def __post_init__(self) -> None:
        self.session_factory, self._engine = create_session_factory(self.settings)
        self.neo4j = Neo4jDriver(self.settings)
        self.event_bus = EventBus()

        self.graph_repo = GraphRepository(self.neo4j)
        self.snapshot_repo = SnapshotRepository(self.session_factory)
        self.job_repo = JobRepository(self.session_factory)
        self.outbox_repo = OutboxRepository(self.session_factory)
        self.audit_repo = AuditRepository(self.session_factory)
        self.curator_repo = CuratorRepository(self.session_factory)
        self.graph_writer = GraphWriter(self.neo4j)

        self.health_service = HealthService(
            settings=self.settings,
            neo4j=self.neo4j,
            session_factory=self.session_factory,
            snapshot_repo=self.snapshot_repo,
        )
        self.drug_service = DrugService(graph_repo=self.graph_repo, settings=self.settings)
        self.explain_service = ExplainService(graph_repo=self.graph_repo)
        self.compare_service = CompareService(graph_repo=self.graph_repo)
        self.learning_service = LearningService(graph_repo=self.graph_repo)
        self.reasoning_service = ReasoningService(
            explain_service=self.explain_service,
            graph_repo=self.graph_repo,
        )
        self.search_service = SearchService()
        self.module_service = ModuleService()
        self.statistics_service = StatisticsService(
            snapshot_repo=self.snapshot_repo,
            graph_repo=self.graph_repo,
        )
        self.curator_service = CuratorService(
            curator_repo=self.curator_repo,
            graph_writer=self.graph_writer,
            outbox_repo=self.outbox_repo,
            job_repo=self.job_repo,
            audit_repo=self.audit_repo,
            event_bus=self.event_bus,
        )

    async def startup(self) -> None:
        from farmacograph.db.postgres.session import init_db

        await init_db(self._engine)
        if self.settings.neo4j_enabled:
            await self.neo4j.connect()
            await self.neo4j.init_schema()

    async def shutdown(self) -> None:
        await self.neo4j.close()
        await self._engine.dispose()


_container: Container | None = None


def get_container() -> Container:
    global _container
    if _container is None:
        _container = Container()
    return _container


def reset_container() -> None:
    """Reset container — for testing only."""
    global _container
    _container = None
    clear_settings_cache()
