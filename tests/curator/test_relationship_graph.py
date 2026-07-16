"""Publish package relationship expansion tests."""

from __future__ import annotations

from farmacograph.curator.drug_package import build_drug_entry_package
from farmacograph.curator.relationship_graph import normalize_drug_relationship_graph


def test_adenosine_skeleton_has_antiarrhythmics_class_id():
    package = build_drug_entry_package("adenosine")
    belongs = package["entity_payload"]["relationships"]["BELONGS_TO"]
    assert belongs == ["b1000001-0000-4000-8010-000000000006"]
    assert any(
        row["relationship_type"] == "BELONGS_TO"
        and row["target_id"] == "b1000001-0000-4000-8010-000000000006"
        for row in package["relationships"]
    )


def test_normalize_expands_belongs_to_map_into_edges():
    drug_id = "b5009004-4195-57fb-b17f-79cf08b30cdf"
    class_id = "b1000001-0000-4000-8010-000000000006"
    package = {
        "entity_payload": {
            "id": drug_id,
            "entity_type": "Drug",
            "slug": "adenosine",
            "label": "Adenosine",
            "module": "cardiovascular",
            "relationships": {"BELONGS_TO": [class_id], "TREATS": [], "HAS_MECHANISM_ROOT": []},
        },
        "related_entities": [],
        "relationships": [],
    }

    normalized = normalize_drug_relationship_graph(package)

    assert any(
        row["relationship_type"] == "BELONGS_TO"
        and row["source_id"] == drug_id
        and row["target_id"] == class_id
        and row["target_type"] == "DrugClass"
        for row in normalized["relationships"]
    )
    related = normalized["related_entities"]
    assert len(related) == 1
    assert related[0]["id"] == class_id
    assert related[0]["slug"] == "antiarrhythmics"
    assert related[0]["entity_type"] == "DrugClass"


def test_normalize_drops_stale_belongs_to_edges():
    drug_id = "b5009004-4195-57fb-b17f-79cf08b30cdf"
    keep = "b1000001-0000-4000-8010-000000000006"
    drop = "b1000001-0000-4000-8010-000000000002"
    package = {
        "entity_payload": {
            "id": drug_id,
            "entity_type": "Drug",
            "slug": "adenosine",
            "module": "cardiovascular",
            "relationships": {"BELONGS_TO": [keep]},
        },
        "related_entities": [],
        "relationships": [
            {
                "relationship_type": "BELONGS_TO",
                "source_type": "Drug",
                "target_type": "DrugClass",
                "source_id": drug_id,
                "target_id": drop,
            },
            {
                "relationship_type": "BELONGS_TO",
                "source_type": "Drug",
                "target_type": "DrugClass",
                "source_id": drug_id,
                "target_id": keep,
            },
        ],
    }

    normalized = normalize_drug_relationship_graph(package)
    belongs = [
        row["target_id"]
        for row in normalized["relationships"]
        if row["relationship_type"] == "BELONGS_TO"
    ]
    assert belongs == [keep]
