"""Staging search — curator staging packages by slug/label (no Neo4j needed).

Used when the graph is unavailable. Results are explicitly staging content;
callers must surface the ``staging-fallback`` provenance so sample data is
never mistaken for published graph results.
"""

from __future__ import annotations

from typing import Any

PROVENANCE_STAGING_FALLBACK = "staging-fallback"


class StagingSearchProvider:
    """Substring search over staging drug packages and the disease catalog."""

    async def search(
        self,
        query: str,
        *,
        limit: int = 20,
        types: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        from farmacograph.curator.disease_package import list_disease_catalog
        from farmacograph.curator.drug_package import CV_DRUGS_DIR, load_package

        needle = query.strip().lower()
        if not needle:
            return []
        want_drugs = types is None or not types or "Drug" in types
        want_diseases = types is None or not types or "Disease" in types
        results: list[dict[str, Any]] = []

        if want_drugs and CV_DRUGS_DIR.exists():
            for path in sorted(CV_DRUGS_DIR.glob("*.json")):
                if len(results) >= limit:
                    break
                try:
                    payload = load_package(path).entity_payload
                except Exception:
                    continue
                slug = str(payload.get("slug", ""))
                label = str(payload.get("label", "") or payload.get("generic_name", ""))
                if needle in slug.lower() or needle in label.lower():
                    results.append(
                        {
                            "id": payload.get("id"),
                            "slug": slug,
                            "label": label,
                            "type": "Drug",
                            "status": payload.get("status", "published"),
                        }
                    )

        if want_diseases and len(results) < limit:
            try:
                rows, _ = list_disease_catalog(search=query, limit=limit, offset=0)
            except Exception:
                rows = []
            for row in rows:
                if len(results) >= limit:
                    break
                results.append(
                    {
                        "id": row.get("id"),
                        "slug": row.get("slug"),
                        "label": row.get("label"),
                        "type": "Disease",
                        "status": row.get("status", "published"),
                    }
                )
        return results

    async def autocomplete(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        return await self.search(query, limit=limit, types=["Drug"])

    async def health_check(self) -> str:
        return "staging-fallback"
