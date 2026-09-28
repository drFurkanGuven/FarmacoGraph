"""FDA DDI Dataset Auto-Sync Pipeline.

Checks Zenodo for updated FDA DDI datasets and imports new versions.

Usage:
    python scripts/sync_fda_ddi.py [--force] [--schedule]
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid5
import httpx

# Namespace for deterministic UUIDs
FDA_DDI_NAMESPACE = UUID("fda0dd12-0260-0000-0000-000000000000")

DATA_DIR = Path(__file__).parent.parent / "data" / "imports" / "fda-ddi-2026"
DDI_FILE = DATA_DIR / "ddi_2026.csv"
DRUGS_FILE = DATA_DIR / "drugs_atc_cid.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "staging" / "fda-ddi-imports"
SYNC_STATE_FILE = DATA_DIR / ".sync_state.json"

ZENODO_RECORD_ID = "19685458"
ZENODO_API_URL = f"https://zenodo.org/api/records/{ZENODO_RECORD_ID}"


def load_sync_state() -> dict[str, Any]:
    """Load last sync state."""
    if SYNC_STATE_FILE.exists():
        with open(SYNC_STATE_FILE, "r") as f:
            return json.load(f)
    return {"last_sync": None, "last_version": None, "last_modified": None}


def save_sync_state(state: dict[str, Any]) -> None:
    """Save sync state."""
    SYNC_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SYNC_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


async def check_for_updates() -> dict[str, Any] | None:
    """Check Zenodo for dataset updates."""
    print(f"Checking Zenodo record {ZENODO_RECORD_ID} for updates...")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(ZENODO_API_URL, timeout=30.0)
            response.raise_for_status()
            data = response.json()

            return {
                "id": data.get("id"),
                "version": data.get("metadata", {}).get("version", "unknown"),
                "modified": data.get("modified"),
                "files": [
                    {
                        "key": f["key"],
                        "size": f["size"],
                        "checksum": f["checksum"],
                        "url": f["links"]["self"],
                    }
                    for f in data.get("files", [])
                ],
            }
        except httpx.HTTPError as e:
            print(f"Error checking Zenodo: {e}")
            return None


async def download_file(url: str, dest: Path) -> bool:
    """Download file from URL."""
    print(f"Downloading {dest.name}...")
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=120.0, follow_redirects=True)
            response.raise_for_status()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(response.content)
            print(f"  Saved to {dest}")
            return True
        except httpx.HTTPError as e:
            print(f"  Error downloading: {e}")
            return False


async def sync_dataset(force: bool = False) -> dict[str, Any]:
    """Sync FDA DDI dataset from Zenodo."""
    state = load_sync_state()
    result = {
        "updated": False,
        "new_version": None,
        "files_downloaded": 0,
        "errors": [],
    }

    remote_info = await check_for_updates()
    if not remote_info:
        result["errors"].append("Failed to check for updates")
        return result

    # Check if update needed
    if not force and state.get("last_modified") == remote_info["modified"]:
        print(f"No updates available. Last sync: {state.get('last_sync')}")
        return result

    print(f"New version available: {remote_info['modified']}")
    result["new_version"] = remote_info["modified"]

    # Download files
    for file_info in remote_info["files"]:
        filename = file_info["key"]
        if filename in ["ddi_2026.csv", "drugs_atc_cid.csv"]:
            dest = DATA_DIR / filename
            success = await download_file(file_info["url"], dest)
            if success:
                result["files_downloaded"] += 1
            else:
                result["errors"].append(f"Failed to download {filename}")

    if result["files_downloaded"] > 0:
        result["updated"] = True
        state["last_sync"] = datetime.utcnow().isoformat()
        state["last_modified"] = remote_info["modified"]
        state["last_version"] = remote_info["version"]
        save_sync_state(state)
        print(f"Sync completed at {state['last_sync']}")

    return result


def load_drugs_map() -> dict[str, dict[str, Any]]:
    """Load drug name -> {cid, atc_codes} mapping."""
    drugs: dict[str, dict[str, Any]] = {}
    if not DRUGS_FILE.exists():
        return drugs
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
    if not DDI_FILE.exists():
        return records

    with open(DDI_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break

            drug1_name = row["drug 1"].strip().lower()
            drug2_name = row["drug 2"].strip().lower()
            interaction = row["interaction"].strip()

            if not drug1_name or not drug2_name or not interaction:
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

    return records


def generate_interaction_id(drug1: str, drug2: str) -> str:
    """Generate deterministic UUID for drug pair."""
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
            "synced_at": datetime.utcnow().isoformat(),
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


async def run_import_pipeline() -> dict[str, Any]:
    """Run the full import pipeline after sync."""
    print("\nRunning import pipeline...")

    drugs_map = load_drugs_map()
    print(f"  Loaded {len(drugs_map)} drugs")

    records = load_ddi_records(drugs_map)
    print(f"  Loaded {len(records)} DDI records")

    package = build_import_package(records)

    output_path = OUTPUT_DIR / "fda-ddi-2026.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(package, f, indent=2, ensure_ascii=False)

    print(f"  Saved import package to {output_path}")

    return {
        "total_interactions": package["metadata"]["total_interactions"],
        "unique_drugs": package["metadata"]["unique_drugs"],
        "severity_counts": package["metadata"]["severity_counts"],
    }


async def main():
    parser = argparse.ArgumentParser(description="Sync FDA DDI dataset from Zenodo")
    parser.add_argument("--force", action="store_true", help="Force sync even if no updates")
    parser.add_argument("--schedule", action="store_true", help="Run as scheduled job")
    args = parser.parse_args()

    print("=" * 60)
    print("FDA DDI Dataset Auto-Sync Pipeline")
    print("=" * 60)

    sync_result = await sync_dataset(force=args.force)

    if sync_result["updated"]:
        print(f"\n✓ Dataset updated to version {sync_result['new_version']}")
        print(f"  Downloaded {sync_result['files_downloaded']} files")

        import_result = await run_import_pipeline()
        print(f"\n✓ Import package generated:")
        print(f"  - {import_result['total_interactions']:,} interactions")
        print(f"  - {import_result['unique_drugs']:,} unique drugs")
        print(f"  - Severity: {import_result['severity_counts']}")
    elif sync_result["errors"]:
        print(f"\n✗ Sync failed: {sync_result['errors']}")
    else:
        print("\n✓ Dataset is up to date")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
