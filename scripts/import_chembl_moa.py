"""ChEMBL MoA Dataset Import Pipeline.

Imports mechanism of action data from ChEMBL into FarmacoGraph.
Source: https://huggingface.co/datasets/alxfgh/ChEMBL_Drug_Instruction_Tuning

Usage:
    python scripts/import_chembl_moa.py [--limit N]
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
CHEMBL_MOA_NAMESPACE = UUID("c4eab110-0000-0000-0000-000000000000")

DATA_DIR = Path(__file__).parent.parent / "data" / "imports" / "chembl-moa"
CHEMBL_FILE = DATA_DIR / "chembl_qa.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "staging" / "chembl-moa-imports"

# MoA-related questions
MOA_QUESTIONS = [
    "Please provide a description of this drug's mechanism of action.",
    "What is the mechanism of action of this drug?",
    "Describe how this drug works at the molecular level.",
]


def smiles_to_id(smiles: str) -> str:
    """Generate deterministic UUID from SMILES."""
    return str(uuid5(CHEMBL_MOA_NAMESPACE, smiles))


def load_chembl_moa(limit: int | None = None) -> list[dict[str, Any]]:
    """Load MoA records from ChEMBL dataset."""
    records: list[dict[str, Any]] = []
    seen_smiles: set[str] = set()

    with open(CHEMBL_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break

            smiles = row.get("SMILES", "").strip()
            question = row.get("Question", "").strip()
            answer = row.get("Answer", "").strip()

            # Filter for MoA questions only
            if not any(moa_q in question for moa_q in MOA_QUESTIONS):
                continue

            if not smiles or not answer:
                continue

            # Deduplicate by SMILES
            if smiles in seen_smiles:
                continue
            seen_smiles.add(smiles)

            records.append({
                "smiles": smiles,
                "mechanism_of_action": answer,
                "question": question,
            })

    print(f"Loaded {len(records)} unique MoA records from ChEMBL")
    return records


def build_import_package(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Build import package JSON structure."""
    moa_entries = []

    for record in records:
        entry_id = smiles_to_id(record["smiles"])

        moa_entries.append({
            "id": entry_id,
            "smiles": record["smiles"],
            "mechanism_of_action": record["mechanism_of_action"],
            "source": "ChEMBL",
            "source_url": "https://www.ebi.ac.uk/chembl/",
            "import_status": "pending_review",
        })

    return {
        "metadata": {
            "source": "ChEMBL Drug Instruction Tuning Dataset",
            "source_url": "https://huggingface.co/datasets/alxfgh/ChEMBL_Drug_Instruction_Tuning",
            "version": "2023.1",
            "total_entries": len(moa_entries),
        },
        "moa_entries": moa_entries,
    }


def main():
    parser = argparse.ArgumentParser(description="Import ChEMBL MoA dataset")
    parser.add_argument("--limit", type=int, help="Limit number of records to import")
    args = parser.parse_args()

    print("=" * 60)
    print("ChEMBL MoA Dataset Import Pipeline")
    print("=" * 60)

    if not CHEMBL_FILE.exists():
        print(f"Error: ChEMBL file not found at {CHEMBL_FILE}")
        sys.exit(1)

    print(f"\nLoading MoA records from {CHEMBL_FILE.name}...")
    records = load_chembl_moa(limit=args.limit)

    print("\nBuilding import package...")
    package = build_import_package(records)

    output_path = OUTPUT_DIR / "chembl-moa-2023.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2, ensure_ascii=False)

    print(f"\nImport package saved to: {output_path}")
    print("\n" + "=" * 60)
    print("Import Summary:")
    print(f"  Total MoA entries: {package['metadata']['total_entries']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
