"""Graph writer serialization tests."""

from __future__ import annotations

import json

import pytest

from farmacograph.repositories.graph_writer import GraphWriter


class FakeDriver:
    is_connected = True

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []

    async def run_query(self, query: str, params: dict):
        self.calls.append((query, params))
        return [{"node": params["props"]}]


@pytest.mark.asyncio
async def test_merge_entity_serializes_nested_properties_for_neo4j():
    driver = FakeDriver()
    writer = GraphWriter(driver)  # type: ignore[arg-type]

    node = await writer.merge_entity(
        "Evidence",
        {
            "id": "evidence-1",
            "title": "FDA label",
            "authors": ["FDA"],
            "provenance": {"source": "manual", "created_by": "curator"},
            "attachments": [{"source_id": "drug-1"}],
        },
    )

    assert node["title"] == "FDA label"
    assert node["authors"] == ["FDA"]
    assert json.loads(node["provenance"]) == {"created_by": "curator", "source": "manual"}
    assert json.loads(node["attachments"]) == [{"source_id": "drug-1"}]


@pytest.mark.asyncio
async def test_merge_entity_rejects_disallowed_label_injection():
    driver = FakeDriver()
    writer = GraphWriter(driver)  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Invalid or disallowed Neo4j entity label"):
        await writer.merge_entity(
            "Drug {id: '1'}) DETACH DELETE n //",
            {"id": "test-1"},
        )


@pytest.mark.asyncio
async def test_merge_relationship_rejects_disallowed_rel_type():
    driver = FakeDriver()
    writer = GraphWriter(driver)  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Invalid or disallowed Neo4j relationship type"):
        await writer.merge_relationship(
            "INVALID_REL_TYPE",
            "source-1",
            "target-1",
            "Drug",
            "Disease",
        )


@pytest.mark.asyncio
async def test_delete_relationship_rejects_invalid_prop_key():
    driver = FakeDriver()
    writer = GraphWriter(driver)  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="Invalid Neo4j property key"):
        await writer.delete_relationship(
            "TREATS",
            "source-1",
            "target-1",
            "Drug",
            "Disease",
            properties={"invalid-key; DROP TABLE;": "val"},
        )
