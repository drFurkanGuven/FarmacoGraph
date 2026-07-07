"""Background worker abstraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from farmacograph.core.logging import get_logger
from farmacograph.repositories.jobs import JobRepository

logger = get_logger(__name__)


class BaseWorker(ABC):
    """Base class for background job workers."""

    job_type: str

    def __init__(self, job_repo: JobRepository) -> None:
        self._job_repo = job_repo

    @abstractmethod
    async def execute(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        """Execute job. Return result dict or None."""

    async def process_job(self, job_id: Any) -> None:
        from uuid import UUID

        jobs = await self._job_repo.fetch_pending(limit=1)
        job = next((j for j in jobs if j.id == job_id), None)
        if job is None:
            return
        await self._job_repo.mark_running(job.id)
        try:
            result = await self.execute(job.payload_json)
            await self._job_repo.mark_completed(job.id, result)
            logger.info("job_completed", job_type=self.job_type, job_id=str(job.id))
        except Exception as exc:
            await self._job_repo.mark_failed(job.id, str(exc))
            logger.error("job_failed", job_type=self.job_type, error=str(exc))


class WorkerRegistry:
    """Registry of job type → worker implementations."""

    def __init__(self) -> None:
        self._workers: dict[str, BaseWorker] = {}

    def register(self, worker: BaseWorker) -> None:
        self._workers[worker.job_type] = worker

    def get(self, job_type: str) -> BaseWorker | None:
        return self._workers.get(job_type)
