"""Education graph normalization tests."""

from __future__ import annotations

from farmacograph.curator.education_graph import normalize_education_graph


def test_normalize_education_graph_adds_related_nodes_and_edges():
    package = {
        "entity_payload": {"id": "drug-1", "entity_type": "Drug", "slug": "ramipril"},
        "related_entities": [],
        "relationships": [],
        "education": [
            {
                "id": "edu-1",
                "kind": "Flashcard",
                "content_layer": "education",
                "front": "Front",
                "back": "Back",
            }
        ],
    }

    normalized = normalize_education_graph(package)

    assert normalized["related_entities"] == [
        {
            "id": "edu-1",
            "kind": "Flashcard",
            "content_layer": "education",
            "front": "Front",
            "back": "Back",
            "entity_type": "EducationResource",
            "linked_entity_ids": ["drug-1"],
        }
    ]
    assert normalized["relationships"] == [
        {
            "relationship_type": "HAS_EDUCATION",
            "source_type": "Drug",
            "target_type": "EducationResource",
            "source_id": "drug-1",
            "target_id": "edu-1",
            "properties": {"kind": "Flashcard"},
        }
    ]


def test_normalize_education_graph_preserves_existing_non_education_edges():
    package = {
        "entity_payload": {"id": "drug-1", "entity_type": "Drug"},
        "related_entities": [{"id": "disease-1", "entity_type": "Disease"}],
        "relationships": [
            {
                "relationship_type": "TREATS",
                "source_type": "Drug",
                "target_type": "Disease",
                "source_id": "drug-1",
                "target_id": "disease-1",
            }
        ],
        "education": [
            {
                "id": "edu-1",
                "entity_type": "EducationResource",
                "kind": "FiveSecondSummary",
                "content_layer": "education",
                "text": "Fast recall.",
            }
        ],
    }

    normalized = normalize_education_graph(package)

    assert any(row["relationship_type"] == "TREATS" for row in normalized["relationships"])
    assert any(row["relationship_type"] == "HAS_EDUCATION" for row in normalized["relationships"])
