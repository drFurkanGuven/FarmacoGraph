"""FDA 2026 DDI Dataset Import Pipeline.

Imports drug-drug interactions from FDA DailyMed labels into FarmacoGraph.
Source: https://doi.org/10.5281/zenodo.19685458

Usage:
    python scripts/import_fda_ddi.py [--output PATH] [--limit N]
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5

# Namespace for deterministic UUIDs
FDA_DDI_NAMESPACE = UUID("fda0dd12-0260-0000-0000-000000000000")

DATA_DIR = Path(__file__).parent.parent / "data" / "imports" / "fda-ddi-2026"
DDI_FILE = DATA_DIR / "ddi_2026.csv"
DRUGS_FILE = DATA_DIR / "drugs_atc_cid.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "staging" / "fda-ddi-imports"


def load_drugs_map() -> dict[str, dict[str, Any]]:
    """Load drug name -> {cid, atc_codes} mapping."""
    drugs: dict[str, dict[str, Any]] = {}
    with open(DRUGS_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["drug_name"].strip().lower()
            drugs[name] = {
                "cid": row.get("cid", ""),
                "atc_codes": row.get("atc_codes", ""),
            }
    return drugs


def load_ddi_records(
    drugs_map: dict[str, dict[str, Any]],
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Load DDI records and enrich with drug metadata."""
    records: list[dict[str, Any]] = []
    skipped = 0

    with open(DDI_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break

            drug1_name = row["drug 1"].strip().lower()
            drug2_name = row["drug 2"].strip().lower()
            interaction = row["interaction"].strip()

            if not drug1_name or not drug2_name or not interaction:
                skipped += 1
                continue

            drug1_info = drugs_map.get(drug1_name, {})
            drug2_info = drugs_map.get(drug2_name, {})

            records.append({
                "drug1_name": drug1_name,
                "drug2_name": drug2_name,
                "interaction": interaction,
                "drug1_cid": drug1_info.get("cid", ""),
                "drug2_cid": drug2_info.get("cid", ""),
                "drug1_atc": drug1_info.get("atc_codes", ""),
                "drug2_atc": drug2_info.get("atc_codes", ""),
            })

    print(f"Loaded {len(records)} DDI records (skipped {skipped} invalid)")
    return records


def generate_interaction_id(drug1: str, drug2: str) -> str:
    """Generate deterministic UUID for drug pair (order-independent)."""
    pair = tuple(sorted([drug1.lower(), drug2.lower()]))
    return str(uuid5(FDA_DDI_NAMESPACE, f"{pair[0]}:{pair[1]}"))


def classify_severity(interaction: str) -> str:
    """Classify interaction severity based on keywords."""
    interaction_lower = interaction.lower()

    contraindicated = [
        "contraindicated", "do not combine", "avoid combination",
        "fatal", "life-threatening", "death", "never combine",
    ]
    major = [
        "severe", "serious", "major", "significant",
        "increased risk", "high risk", "toxicity",
        "hemorrhage", "bleeding", "arrhythmia", "hypotension",
        "respiratory depression", "cns depression", "cardiac",
        "hypertensive crisis", "serotonin syndrome", "seizure",
        "stroke", "myocardial", "hepatotoxicity", "nephrotoxicity",
        "hyperkalemia", "hyponatremia", "hypoglycemia",
    ]
    moderate = [
        "moderate", "caution", "monitor", "adjust",
        "may increase", "potential risk", "decrease",
        "increase", "enhance", "reduce", "impair",
        "additive", "synergistic", "potentiate",
    ]

    for keyword in contraindicated:
        if keyword in interaction_lower:
            return "contraindicated"

    for keyword in major:
        if keyword in interaction_lower:
            return "major"

    for keyword in moderate:
        if keyword in interaction_lower:
            return "moderate"

    return "minor"


def build_import_package(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Build import package JSON structure."""
    interactions = []
    drug_names: set[str] = set()

    for record in records:
        interaction_id = generate_interaction_id(
            record["drug1_name"],
            record["drug2_name"],
        )
        severity = classify_severity(record["interaction"])

        drug_names.add(record["drug1_name"])
        drug_names.add(record["drug2_name"])

        interactions.append({
            "id": interaction_id,
            "drug_a_name": record["drug1_name"],
            "drug_b_name": record["drug2_name"],
            "drug_a_cid": record["drug1_cid"],
            "drug_b_cid": record["drug2_cid"],
            "drug_a_atc": record["drug1_atc"],
            "drug_b_atc": record["drug2_atc"],
            "severity": severity,
            "title": f"{record['drug1_name'].title()} + {record['drug2_name'].title()}: {record['interaction'].title()}",
            "mechanism_explanation": record["interaction"],
            "clinical_action": f"Monitor patient for {record['interaction']}. Consult prescribing information.",
            "source": "FDA DailyMed 2026",
            "source_doi": "10.5281/zenodo.19685458",
            "import_status": "pending_review",
        })

    return {
        "metadata": {
            "source": "FDA DailyMed 2026 DDI Dataset",
            "doi": "10.5281/zenodo.19685458",
            "version": "2026.1",
            "imported_at": None,
            "total_interactions": len(interactions),
            "unique_drugs": len(drug_names),
            "severity_counts": {
                "contraindicated": sum(1 for i in interactions if i["severity"] == "contraindicated"),
                "major": sum(1 for i in interactions if i["severity"] == "major"),
                "moderate": sum(1 for i in interactions if i["severity"] == "moderate"),
                "minor": sum(1 for i in interactions if i["severity"] == "minor"),
            },
        },
        "interactions": interactions,
    }


def main():
    parser = argparse.ArgumentParser(description="Import FDA 2026 DDI dataset")
    parser.add_argument("--output", type=str, help="Output file path")
    parser.add_argument("--limit", type=int, help="Limit number of records to import")
    args = parser.parse_args()

    print("=" * 60)
    print("FDA 2026 DDI Dataset Import Pipeline")
    print("=" * 60)

    if not DDI_FILE.exists():
        print(f"Error: DDI file not found at {DDI_FILE}")
        sys.exit(1)

    if not DRUGS_FILE.exists():
        print(f"Error: Drugs file not found at {DRUGS_FILE}")
        sys.exit(1)

    print(f"\nLoading drug metadata from {DRUGS_FILE.name}...")
    drugs_map = load_drugs_map()
    print(f"  Found {len(drugs_map)} drugs with CID/ATC mappings")

    print(f"\nLoading DDI records from {DDI_FILE.name}...")
    records = load_ddi_records(drugs_map, limit=args.limit)

    print("\nBuilding import package...")
    package = build_import_package(records)

    output_path = Path(args.output) if args.output else OUTPUT_DIR / "fda-ddi-2026.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2, ensure_ascii=False)

    print(f"\nImport package saved to: {output_path}")
    print("\n" + "=" * 60)
    print("Import Summary:")
    print(f"  Total interactions: {package['metadata']['total_interactions']}")
    print(f"  Unique drugs: {package['metadata']['unique_drugs']}")
    print(f"  Severity breakdown:")
    for severity, count in package['metadata']['severity_counts'].items():
        print(f"    - {severity}: {count}")
    print("=" * 60)


if __name__ == "__main__":
    main()
