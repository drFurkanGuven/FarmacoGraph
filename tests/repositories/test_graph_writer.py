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
