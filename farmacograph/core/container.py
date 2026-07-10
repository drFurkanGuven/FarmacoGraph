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
from farmacograph.repositories.evidence import EvidenceRepository
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.graph_writer import GraphWriter
from farmacograph.repositories.jobs import JobRepository
from farmacograph.repositories.outbox import OutboxRepository
from farmacograph.repositories.snapshots import SnapshotRepository
from farmacograph.search.graph_provider import GraphSearchProvider
from farmacograph.services.admin_users import AdminUsersService
from farmacograph.services.compare import CompareService
from farmacograph.services.curator import CuratorService
from farmacograph.services.curriculum import CurriculumService
from farmacograph.services.dashboard import DashboardService
from farmacograph.services.diseases import DiseaseService
from farmacograph.services.drugs import DrugService
from farmacograph.services.evidence import EvidenceService
from farmacograph.services.explain import ExplainService
from farmacograph.services.health import HealthService
from farmacograph.services.info import InfoService
from farmacograph.services.learning import LearningService
from farmacograph.services.modules import ModuleService
from farmacograph.services.reasoning import ReasoningService
from farmacograph.services.search import NullSearchProvider, SearchService
from farmacograph.services.snapshot import SnapshotService
from farmacograph.services.statistics import StatisticsService
from farmacograph.workers.graph_validation import GraphValidationWorker


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
    evidence_repo: EvidenceRepository = field(init=False)
    graph_writer: GraphWriter = field(init=False)

    # Services
    health_service: HealthService = field(init=False)
    info_service: InfoService = field(init=False)
    drug_service: DrugService = field(init=False)
    disease_service: DiseaseService = field(init=False)
    evidence_service: EvidenceService = field(init=False)
    explain_service: ExplainService = field(init=False)
    compare_service: CompareService = field(init=False)
    learning_service: LearningService = field(init=False)
    reasoning_service: ReasoningService = field(init=False)
    search_service: SearchService = field(init=False)
    module_service: ModuleService = field(init=False)
    curriculum_service: CurriculumService = field(init=False)
    statistics_service: StatisticsService = field(init=False)
    dashboard_service: DashboardService = field(init=False)
    curator_service: CuratorService = field(init=False)
    snapshot_service: SnapshotService = field(init=False)
    admin_users_service: AdminUsersService = field(init=False)
    graph_validation_worker: GraphValidationWorker = field(init=False)

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
        self.evidence_repo = EvidenceRepository(self.neo4j, self.graph_writer)

        self.health_service = HealthService(
            settings=self.settings,
            neo4j=self.neo4j,
            session_factory=self.session_factory,
            snapshot_repo=self.snapshot_repo,
        )
        self.info_service = InfoService(self.settings, self.snapshot_repo, self.graph_repo)
        self.drug_service = DrugService(graph_repo=self.graph_repo, settings=self.settings)
        self.disease_service = DiseaseService(settings=self.settings)
        self.evidence_service = EvidenceService(
            evidence_repo=self.evidence_repo,
            audit_repo=self.audit_repo,
            settings=self.settings,
        )
        self.explain_service = ExplainService(graph_repo=self.graph_repo)
        self.compare_service = CompareService(graph_repo=self.graph_repo)
        self.learning_service = LearningService(graph_repo=self.graph_repo)
        self.reasoning_service = ReasoningService(
            explain_service=self.explain_service,
            graph_repo=self.graph_repo,
        )
        search_provider = (
            GraphSearchProvider(self.graph_repo)
            if self.settings.neo4j_enabled
            else NullSearchProvider()
        )
        self.search_service = SearchService(
            search_provider,
            snapshot_repo=self.snapshot_repo,
            ontology_version=self.settings.ontology_version,
        )
        self.module_service = ModuleService(
            graph_repo=self.graph_repo,
            snapshot_repo=self.snapshot_repo,
        )
        self.curriculum_service = CurriculumService(graph_repo=self.graph_repo)
        self.statistics_service = StatisticsService(
            snapshot_repo=self.snapshot_repo,
            graph_repo=self.graph_repo,
        )
        self.dashboard_service = DashboardService(
            health_service=self.health_service,
            statistics_service=self.statistics_service,
            audit_repo=self.audit_repo,
            job_repo=self.job_repo,
            curator_repo=self.curator_repo,
            graph_repo=self.graph_repo,
            snapshot_repo=self.snapshot_repo,
        )
        self.snapshot_service = SnapshotService(
            snapshot_repo=self.snapshot_repo,
            graph_repo=self.graph_repo,
        )
        self.graph_validation_worker = GraphValidationWorker(
            self.job_repo,
            self.graph_repo,
        )
        self.curator_service = CuratorService(
            curator_repo=self.curator_repo,
            graph_repo=self.graph_repo,
            graph_writer=self.graph_writer,
            outbox_repo=self.outbox_repo,
            job_repo=self.job_repo,
            audit_repo=self.audit_repo,
            event_bus=self.event_bus,
            snapshot_service=self.snapshot_service,
            graph_validation_worker=self.graph_validation_worker,
        )
        self.admin_users_service = AdminUsersService(
            session_factory=self.session_factory,
            settings=self.settings,
        )

    async def startup(self) -> None:
        from farmacograph.db.postgres.seed import seed_dev_users
        from farmacograph.db.postgres.session import init_db

        await init_db(self._engine)
        await seed_dev_users(self.session_factory, self.settings)
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
