"""FDA DailyMed drug-drug interaction records held in PostgreSQL.

These are external reference rows, not curator-authored content: they are
labelled ``curation_status='external'`` and surfaced to clients with
``source='external'`` so they are never presented as reviewed graph edges.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


class FdaDdiRepository:
    """Read access to drug_drug_interactions."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def is_available(self) -> bool:
        try:
            async with self._session_factory() as session:
                await session.execute(text("SELECT 1 FROM drug_drug_interactions LIMIT 1"))
            return True
        except Exception:
            return False

    async def find_by_drug_ids(
        self, drug_ids: list[str], *, limit: int = 200
    ) -> list[dict[str, Any]]:
        """Pairs where any checked drug appears as either endpoint.

        The relationship is symmetric, so both columns are matched and the
        stored pair is returned in its canonical order.
        """
        if not drug_ids:
            return []

        uuids: list[UUID] = []
        for value in drug_ids:
            try:
                uuids.append(UUID(str(value)))
            except (ValueError, AttributeError, TypeError):
                continue
        if not uuids:
            return []

        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    """
                    SELECT id, drug_a_id, drug_b_id, drug_a_slug, drug_b_slug,
                           title, severity, mechanism_explanation, clinical_action,
                           curation_status, source, evidence_ids
                    FROM drug_drug_interactions
                    WHERE drug_a_id = ANY(:ids) OR drug_b_id = ANY(:ids)
                    ORDER BY severity, title
                    LIMIT :limit
                    """
                ),
                {"ids": uuids, "limit": limit},
            )
            return [dict(row._mapping) for row in result]

    async def count(self) -> int:
        async with self._session_factory() as session:
            result = await session.execute(
                text("SELECT count(*) AS n FROM drug_drug_interactions")
            )
            return int(result.scalar() or 0)
