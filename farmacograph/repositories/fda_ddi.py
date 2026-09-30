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
        """Pairs whose BOTH endpoints are among the checked drugs.

        The relationship is symmetric and the check is about a specific
        combination, so both endpoints must be selected. Matching either
        endpoint returned every documented interaction of a checked drug
        against unrelated drugs, which answers a different question.
        """
        if not drug_ids:
            return []

        uuids: list[UUID] = []
        for value in drug_ids:
            try:
                uuids.append(UUID(str(value)))
            except (ValueError, AttributeError, TypeError):
                continue
        if len(uuids) < 2:
            return []

        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    """
                    SELECT id, drug_a_id, drug_b_id, drug_a_slug, drug_b_slug,
                           title, severity, mechanism_explanation, clinical_action,
                           curation_status, source, evidence_ids
                    FROM drug_drug_interactions
                    WHERE drug_a_id = ANY(:ids) AND drug_b_id = ANY(:ids)
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
