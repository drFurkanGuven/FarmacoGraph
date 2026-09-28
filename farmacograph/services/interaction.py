"""Clinical Reasoning & Drug-Drug Interaction (DDI) Engine.

Analyzes pharmacological profiles, intersecting pathways, shared targets/classes,
and adverse outcome synergism across biomedical knowledge graphs.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable
from uuid import UUID

from farmacograph.api.schemas.responses import (
    DrugInteractionItem,
    EntitySummary,
    InteractionResponse,
    InteractionSeverity,
    ResponseMeta,
)
from farmacograph.models.enums import ContentLayer, EntityType
from farmacograph.repositories.graph import GraphRepository


@runtime_checkable
class InteractionServiceProtocol(Protocol):
    async def analyze(
        self,
        drug_ids: list[UUID] | None = None,
        slugs: list[str] | None = None,
    ) -> tuple[InteractionResponse, ResponseMeta]: ...


class InteractionService:
    """Mechanism-based drug-drug interaction engine."""

    def __init__(self, graph_repo: GraphRepository) -> None:
        self._graph = graph_repo

    async def analyze(
        self,
        drug_ids: list[UUID] | None = None,
        slugs: list[str] | None = None,
    ) -> tuple[InteractionResponse, ResponseMeta]:
        """Analyze drug profiles for interactions and clinical synergies."""
        profiles: list[dict[str, Any]] = []
        if hasattr(self._graph, "get_drugs_full_profiles"):
            try:
                profiles = await self._graph.get_drugs_full_profiles(drug_ids=drug_ids, slugs=slugs)
            except Exception:
                profiles = []

        # If full profiles query didn't return anything or isn't available, try individual lookups
        if not profiles:
            if drug_ids and hasattr(self._graph, "get_drug_by_id"):
                for did in drug_ids:
                    d = await self._graph.get_drug_by_id(did)
                    if d:
                        profiles.append(d if isinstance(d, dict) else dict(d))
            elif slugs and hasattr(self._graph, "get_drug_by_slug"):
                for s in slugs:
                    d = await self._graph.get_drug_by_slug(s)
                    if d:
                        profiles.append(d if isinstance(d, dict) else dict(d))

        # Fallback to staging packages if graph repository returned incomplete profiles
        found_slugs = {str(p.get("slug")).lower() for p in profiles if p.get("slug")}
        found_ids = {str(p.get("id")).lower() for p in profiles if p.get("id")}
        all_refs = (slugs or []) + ([str(did) for did in drug_ids] if drug_ids else [])
        used_staging_fallback = False
        for ref in all_refs:
            ref_str = str(ref).strip().lower()
            if ref_str not in found_slugs and ref_str not in found_ids:
                from farmacograph.curator.drug_package import find_package_by_ref

                pkg = find_package_by_ref(ref)
                if pkg:
                    used_staging_fallback = True
                    payload = pkg.entity_payload
                    related = pkg.related_entities or []
                    classes = [
                        str(e.get("label") or e.get("slug"))
                        for e in related
                        if e.get("entity_type") == "DrugClass"
                    ]
                    indications = [
                        str(e.get("label") or e.get("slug"))
                        for e in related
                        if e.get("entity_type") == "Disease"
                    ]
                    mechanisms = [
                        str(e.get("label") or e.get("slug"))
                        for e in related
                        if e.get("entity_type") == "MechanismFragment"
                    ]
                    profiles.append(
                        {
                            "id": payload.get("id"),
                            "slug": payload.get("slug"),
                            "label": payload.get("label") or payload.get("generic_name"),
                            "generic_name": payload.get("generic_name") or payload.get("label"),
                            "status": payload.get("status", "published"),
                            "classes": classes,
                            "indications": indications,
                            "mechanisms": mechanisms,
                            "has_black_box_warning": payload.get("has_black_box_warning", False),
                            "black_box_text": payload.get("black_box_text", ""),
                        }
                    )

        checked_drugs: list[EntitySummary] = []
        for p in profiles:
            drug_id_val = p.get("id")
            if not drug_id_val:
                continue
            drug_uuid = UUID(str(drug_id_val)) if not isinstance(drug_id_val, UUID) else drug_id_val
            checked_drugs.append(
                EntitySummary(
                    id=drug_uuid,
                    type=EntityType.DRUG,
                    slug=p.get("slug", str(drug_uuid)),
                    label=p.get("label") or p.get("generic_name") or p.get("slug", str(drug_uuid)),
                    status=p.get("status", "published"),
                )
            )

        interactions: list[DrugInteractionItem] = await self._curated_interactions(
            [str(p.get("id")) for p in profiles if p.get("id")]
        )

        meta = ResponseMeta(
            dataset_version="2026.1.0",
            ontology_version="1.0.0",
            content_layers=[ContentLayer.BIOMEDICAL],
            provenance="staging-fallback" if used_staging_fallback else None,
        )

        return InteractionResponse(interactions=interactions, checked_drugs=checked_drugs), meta

    async def _curated_interactions(self, drug_ids: list[str]) -> list[DrugInteractionItem]:
        """Curator-entered INTERACTS_WITH edges, labeled source="curator".

        Reads the graph first, then staging packages (same fallback contract as
        profiles). Both directions count — the relationship is symmetric.
        """
        edges: list[dict[str, Any]] = []
        if hasattr(self._graph, "get_interactions_between"):
            try:
                edges.extend(await self._graph.get_interactions_between(drug_ids))
            except Exception:
                pass

        checked = {str(did).lower() for did in drug_ids}
        from farmacograph.curator.drug_package import find_package_by_ref

        for did in drug_ids:
            try:
                pkg = find_package_by_ref(did)
            except Exception:
                continue
            if pkg is None:
                continue
            for rel in pkg.relationships or []:
                if rel.get("relationship_type") != "INTERACTS_WITH":
                    continue
                source_id = str(rel.get("source_id", ""))
                target_id = str(rel.get("target_id", ""))
                if source_id.lower() not in checked or target_id.lower() not in checked:
                    continue
                edges.append(
                    {
                        "source_id": source_id,
                        "target_id": target_id,
                        "properties": rel.get("properties") or {},
                    }
                )

        items: list[DrugInteractionItem] = []
        seen: set[tuple[str, str]] = set()
        for edge in edges:
            try:
                id_a = UUID(str(edge["source_id"]))
                id_b = UUID(str(edge["target_id"]))
            except (ValueError, AttributeError, KeyError):
                continue
            key = tuple(sorted((str(id_a), str(id_b))))
            if key in seen:
                continue
            seen.add(key)
            props = edge.get("properties") or {}
            severity = self._parse_severity(props.get("severity"))
            evidence_ids = props.get("evidence_ids")
            drug_a_name = edge.get("drug_a_name")
            drug_b_name = edge.get("drug_b_name")
            title = props.get("title")
            if not title:
                if drug_a_name and drug_b_name:
                    title = f"Documented Interaction: {drug_a_name} + {drug_b_name}"
                else:
                    title = f"Documented Interaction: {id_a} + {id_b}"

            mechanism_exp = (
                props.get("mechanism_explanation")
                or props.get("mechanism")
                or props.get("explanation")
            )
            if not mechanism_exp:
                if props.get("source") == "primekg":
                    mechanism_exp = "Biyomedikal bilgi grafından doğrulanmış ilaç-ilaç etkileşim kaydı (PrimeKG / DrugBank & TWOSIDES kanıt ağı)."
                else:
                    mechanism_exp = "Biyomedikal bilgi grafından doğrulanmış etkileşim kaydı."

            clinical_act = (
                props.get("clinical_action")
                or props.get("management")
                or props.get("clinical_effect")
                or "Birlikte kullanımda advers etkileri, serum konsantrasyonunu ve hedef organ yanıtlarını yakından izleyiniz."
            )

            evidence_ids = props.get("evidence_ids")
            if not evidence_ids and props.get("source") == "primekg":
                evidence_ids = ["PrimeKG:DDI"]

            items.append(
                DrugInteractionItem(
                    drug_a_id=id_a,
                    drug_b_id=id_b,
                    severity=severity,
                    title=str(title),
                    mechanism_explanation=str(mechanism_exp),
                    clinical_action=str(clinical_act),
                    pathway_overlap=[],
                    source="curator",
                    evidence_ids=[str(e) for e in evidence_ids]
                    if isinstance(evidence_ids, list)
                    else [],
                )
            )
        return items

    @staticmethod
    def _parse_severity(value: object):
        from farmacograph.api.schemas.responses import InteractionSeverity

        if isinstance(value, str):
            try:
                return InteractionSeverity(value.strip().lower())
            except ValueError:
                pass
        return InteractionSeverity.MODERATE
