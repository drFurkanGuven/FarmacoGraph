"""Dashboard service — operational overview for Curation Studio."""

from __future__ import annotations

from typing import Any

from farmacograph.api.schemas.responses import ResponseMeta
from farmacograph.curator.drug_package import curriculum_stats, load_curriculum
from farmacograph.repositories.audit import AuditRepository
from farmacograph.repositories.curator import CuratorRepository
from farmacograph.repositories.graph import GraphRepository
from farmacograph.repositories.jobs import JobRepository
from farmacograph.repositories.snapshots import SnapshotRepository
from farmacograph.services.health import HealthService
from farmacograph.services.statistics import StatisticsService


def _audit_to_dict(entry) -> dict[str, Any]:
    return {
        "id": str(entry.id),
        "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
        "action": entry.action,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "actor_id": str(entry.actor_id) if entry.actor_id else None,
        "diff": entry.diff_json,
    }


def _job_to_dict(job) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "job_type": job.job_type,
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "error_message": job.error_message,
        "payload": job.payload_json,
    }


def _workflow_to_dict(workflow, entity: dict[str, Any] | None = None) -> dict[str, Any]:
    data = {
        "id": str(workflow.id),
        "entity_id": workflow.entity_id,
        "entity_type": workflow.entity_type,
        "state": workflow.state,
        "notes": workflow.notes,
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
        "unpublish_requested_at": (
            workflow.unpublish_requested_at.isoformat()
            if getattr(workflow, "unpublish_requested_at", None)
            else None
        ),
        "unpublish_requested_by": (
            str(workflow.unpublish_requested_by)
            if getattr(workflow, "unpublish_requested_by", None)
            else None
        ),
        "unpublish_request_notes": getattr(workflow, "unpublish_request_notes", None),
    }
    if entity:
        data["entity_label"] = entity.get("label") or entity.get("generic_name")
        data["entity_slug"] = entity.get("slug")
    return data


class DashboardService:
    def __init__(
        self,
        health_service: HealthService,
        statistics_service: StatisticsService,
        audit_repo: AuditRepository,
        job_repo: JobRepository,
        curator_repo: CuratorRepository,
        graph_repo: GraphRepository,
        snapshot_repo: SnapshotRepository,
    ) -> None:
        self._health = health_service
        self._statistics = statistics_service
        self._audit = audit_repo
        self._jobs = job_repo
        self._curator = curator_repo
        self._graph = graph_repo
        self._snapshots = snapshot_repo

    async def get_dashboard(
        self, *, module: str = "cardiovascular"
    ) -> tuple[dict[str, Any], ResponseMeta]:
        health_data = await self._health.check()
        stats_data, stats_meta = await self._statistics.get_statistics()

        queue_counts = await self._curator.count_by_state()
        review_queue = await self._curator.list_by_state("review", limit=10)
        draft_queue = await self._curator.list_by_state("draft", limit=10)
        published_recent = await self._curator.list_by_state("published", limit=10)
        unpublish_requests = await self._curator.list_unpublish_requests(limit=10)

        published_enriched = await self._enrich_workflows(published_recent)
        unpublish_enriched = await self._enrich_workflows(unpublish_requests)
        activity = await self._audit.list_recent(limit=15)
        jobs = await self._jobs.list_recent(limit=10)
        job_counts = await self._jobs.count_by_status()
        failed_jobs = await self._jobs.list_recent(limit=10, status="failed")

        snapshot = await self._snapshots.get_latest_published()
        curriculum = load_curriculum() if module == "cardiovascular" else None
        curriculum_data = None
        if curriculum:
            cstats = curriculum_stats(curriculum)
            published_in_graph = await self._graph.count_drugs(module=module)
            curriculum_data = {
                "stats": cstats,
                "published_in_graph": published_in_graph,
                "completion_pct": round(
                    (published_in_graph / cstats["total_slugs"] * 100)
                    if cstats["total_slugs"]
                    else 0,
                    1,
                ),
            }

        data: dict[str, Any] = {
            "published_drugs": await self._graph.count_drugs(module=module),
            "health": health_data,
            "statistics": stats_data,
            "snapshot": {
                "version_tag": snapshot.version_tag if snapshot else None,
                "status": snapshot.status if snapshot else None,
                "released_at": snapshot.released_at.isoformat()
                if snapshot and snapshot.released_at
                else None,
                "entity_count": snapshot.entity_count if snapshot else 0,
            },
            "curator": {
                "queue_counts": queue_counts,
                "pending_review": [_workflow_to_dict(w) for w in review_queue],
                "drafts": [_workflow_to_dict(w) for w in draft_queue],
                "recently_published": published_enriched,
                "unpublish_requests": unpublish_enriched,
            },
            "activity": [_audit_to_dict(a) for a in activity],
            "jobs": {
                "counts": job_counts,
                "recent": [_job_to_dict(j) for j in jobs],
            },
            "validation": {
                "failed_count": job_counts.get("failed", 0),
                "recent_failures": [
                    {
                        "source": "job",
                        "job_id": str(j.id),
                        "job_type": j.job_type,
                        "entity_id": (j.payload_json or {}).get("entity_id"),
                        "message": j.error_message,
                        "at": j.completed_at.isoformat() if j.completed_at else None,
                    }
                    for j in failed_jobs
                ],
            },
            "module": module,
            "curriculum": curriculum_data,
        }
        return data, stats_meta

    async def list_audit_logs(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        resource_type: str | None = None,
    ) -> list[dict[str, Any]]:
        entries = await self._audit.list_recent(
            limit=limit, offset=offset, resource_type=resource_type
        )
        return [_audit_to_dict(e) for e in entries]

    async def list_jobs(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        status: str | None = None,
        job_type: str | None = None,
    ) -> list[dict[str, Any]]:
        jobs = await self._jobs.list_recent(
            limit=limit, offset=offset, status=status, job_type=job_type
        )
        return [_job_to_dict(j) for j in jobs]

    async def get_validation_summary(self) -> dict[str, Any]:
        job_counts = await self._jobs.count_by_status(job_type="graph_validation")
        failed = await self._jobs.list_recent(
            limit=10, status="failed", job_type="graph_validation"
        )
        return {
            "failed_count": job_counts.get("failed", 0),
            "pending_count": job_counts.get("pending", 0),
            "recent_failures": [
                {
                    "source": "job",
                    "job_id": str(j.id),
                    "job_type": j.job_type,
                    "entity_id": (j.payload_json or {}).get("entity_id"),
                    "message": j.error_message,
                    "at": j.completed_at.isoformat() if j.completed_at else None,
                }
                for j in failed
            ],
        }

    async def _enrich_workflows(self, workflows: list) -> list[dict[str, Any]]:
        enriched: list[dict[str, Any]] = []
        for wf in workflows:
            entity = None
            if wf.entity_type == "Drug" and self._graph.is_available:
                entity = await self._graph.get_drug_summary_by_id(wf.entity_id)
            enriched.append(_workflow_to_dict(wf, entity))
        return enriched
