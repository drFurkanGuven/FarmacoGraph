"""Evidence validator unit tests."""

from __future__ import annotations

from farmacograph.validators.evidence_validator import EvidenceValidator


def test_treats_without_evidence_fails_fg_c012():
    validator = EvidenceValidator()
    result = validator.validate_package(
        {
            "id": "00000000-0000-4000-8000-000000000001",
            "entity_type": "Drug",
            "provenance": {"curator_attestation": True},
            "relationships": {"TREATS": ["00000000-0000-4000-8000-000000000003"]},
        },
        relationships=[
            {
                "relationship_type": "TREATS",
                "source_id": "00000000-0000-4000-8000-000000000001",
                "target_id": "00000000-0000-4000-8000-000000000003",
                "source_type": "Drug",
                "target_type": "Disease",
            }
        ],
    )
    assert result.valid is False
    assert any(issue.constraint_id == "FG-C012" for issue in result.errors)


def test_expert_consensus_with_attestation_passes_without_supported_by():
    validator = EvidenceValidator()
    result = validator.validate_package(
        {
            "id": "00000000-0000-4000-8000-000000000001",
            "entity_type": "Drug",
            "provenance": {"curator_attestation": True},
            "relationships": {"TREATS": ["00000000-0000-4000-8000-000000000003"]},
        },
        relationships=[
            {
                "relationship_type": "TREATS",
                "source_id": "00000000-0000-4000-8000-000000000001",
                "target_id": "00000000-0000-4000-8000-000000000003",
                "source_type": "Drug",
                "target_type": "Disease",
                "properties": {
                    "confidence_score": 0.8,
                    "evidence_level": "expert_consensus",
                    "explanation": "Curator attested expert consensus.",
                },
            }
        ],
    )
    assert result.valid is True


def test_supported_by_edge_satisfies_fg_c012():
    validator = EvidenceValidator()
    drug_id = "00000000-0000-4000-8000-000000000001"
    disease_id = "00000000-0000-4000-8000-000000000003"
    evidence_id = "00000000-0000-4000-8000-000000000010"
    result = validator.validate_package(
        {
            "id": drug_id,
            "entity_type": "Drug",
            "provenance": {"curator_attestation": True},
            "relationships": {"TREATS": [disease_id]},
        },
        relationships=[
            {
                "relationship_type": "TREATS",
                "source_id": drug_id,
                "target_id": disease_id,
                "source_type": "Drug",
                "target_type": "Disease",
                "properties": {
                    "confidence_score": 0.9,
                    "evidence_level": "A",
                    "explanation": "Supported by guideline evidence.",
                },
            },
            {
                "relationship_type": "SUPPORTED_BY",
                "source_id": drug_id,
                "target_id": evidence_id,
                "source_type": "Drug",
                "target_type": "Evidence",
                "properties": {
                    "assertion_relationship": "TREATS",
                    "assertion_target_id": disease_id,
                    "assertion_target_type": "Disease",
                },
            },
        ],
    )
    assert result.valid is True
