"""Move the FDA DDI dataset out of curator_workflows into its own table.

The 19,054 imported pairs were written into curator_workflows, which is the
curator review queue. That made every external pair look like a pending curator
task, and nothing ever read them: /api/v1/interactions consults Neo4j
INTERACTS_WITH edges plus the rule engine, so the dataset was invisible.

This script moves the rows into drug_drug_interactions, resolves drug_a_name /
drug_b_name to real Drug node ids in Neo4j, and reports how many endpoints
could not be resolved instead of silently dropping those pairs.

Usage:
    python scripts/migrate_fda_ddi_to_interactions.py [--dry-run] [--keep-workflows]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import asyncpg

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def normalize_name(name: str) -> str:
    """Fold a drug name to a slug-ish key for matching against Drug.slug."""
    s = str(name or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


# FDA DailyMed labels name marketed products; PrimeKG names active ingredients.
# Salt and formulation suffixes are stripped so "acebutolol hydrochloride"
# matches the PrimeKG drug "acebutolol". Brand names (Abilify Maintena) and
# combination products ("acetaminophen and codeine") have no single PrimeKG
# counterpart and are deliberately left unresolved rather than fuzzily matched:
# pairing the wrong drug in a DDI record is worse than omitting the record.
SALT_SUFFIXES = (
    "hydrochloride", "dihydrochloride", "trihydrochloride", "hcl",
    "sulfate", "sulphate", "sodium", "potassium", "calcium", "magnesium",
    "acetate", "succinate", "fumarate", "maleate", "tartrate", "citrate",
    "phosphate", "mesylate", "mesylate", "besylate", "tosylate", "malate",
    "lactate", "benzoate", "hydrobromide", "bromide", "chloride",
    "hydroxide", "nitrate", "carbonate", "oxalate", "valerate", "caproate",
    "dextrose", "hydrate", "anhydrous", "dihydrate", "monohydrate",
    "er", "xr", "sr", "dr", "la", "xl", "cd",
)


def resolve_drug(slug: str, index: tuple[dict[str, str], dict[str, str]]) -> str | None:
    """Conservative FDA-name -> Drug id resolution. None when ambiguous."""
    by_slug, by_name = index
    for table in (by_slug, by_name):
        hit = table.get(slug)
        if hit:
            return hit

    parts = slug.split("-")
    # Drop trailing formulation tokens one at a time, longest first.
    for suffix in sorted(SALT_SUFFIXES, key=len, reverse=True):
        tail = f"-{suffix}"
        if slug.endswith(tail):
            trimmed = slug[: -len(tail)]
            for table in (by_slug, by_name):
                hit = table.get(trimmed)
                if hit:
                    return hit
            # Multi-word suffixes: "acebutolol hydrochloride" -> "acebutolol"
            if parts and parts[-1] == suffix:
                trimmed2 = "-".join(parts[:-1])
                for table in (by_slug, by_name):
                    hit = table.get(trimmed2)
                    if hit:
                        return hit
    return None


async def load_drug_index() -> tuple[dict[str, str], dict[str, str]]:
    """Map normalized drug name -> (slug, uuid) from Neo4j.

    Two lookups are built because PrimeKG names differ from FDA labels in case
    and punctuation: one keyed on the node slug, one on the display name.
    """
    from neo4j import GraphDatabase

    uri = os.environ.get("FG_NEO4J_URI", "bolt://neo4j:7687")
    user = os.environ.get("FG_NEO4J_USER", "neo4j")
    password = os.environ.get("FG_NEO4J_PASSWORD", "farmacograph")

    driver = GraphDatabase.driver(uri, auth=(user, password))
    by_slug: dict[str, str] = {}
    by_name: dict[str, str] = {}
    try:
        with driver.session() as session:
            rows = session.run(
                """
                MATCH (d:Drug)
                WHERE d.status = 'published' OR d.status IS NULL
                RETURN d.id AS id, d.slug AS slug,
                       coalesce(d.generic_name, d.label, d.name) AS name
                """
            )
            for r in rows:
                uid, slug, name = r["id"], r["slug"], r["name"]
                if slug:
                    by_slug.setdefault(normalize_name(slug), uid)
                if name:
                    by_name.setdefault(normalize_name(name), uid)
    finally:
        driver.close()
    return by_slug, by_name


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--keep-workflows",
        action="store_true",
        help="Leave the curator_workflows rows in place (default: delete after copy).",
    )
    args = ap.parse_args()

    dsn = os.environ.get("FG_DATABASE_URL", "")
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://")

    by_slug, by_name = await load_drug_index()
    print(f"Neo4j drug index: {len(by_slug):,} slugs, {len(by_name):,} names")

    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch(
            """
            SELECT draft_package_json AS payload
            FROM curator_workflows
            WHERE entity_type = 'Interaction'
            """
        )
        print(f"curator_workflows Interaction rows: {len(rows):,}")

        seen: set[tuple[str, str]] = set()
        insert_rows: list[tuple[Any, ...]] = []
        unresolved_a = unresolved_b = 0

        for r in rows:
            # asyncpg returns jsonb as text unless a codec is registered.
            p = r["payload"]
            if isinstance(p, (str, bytes, bytearray)):
                p = json.loads(p)
            if not isinstance(p, dict):
                continue
            ep = p.get("entity_payload") or {}
            a = normalize_name(ep.get("drug_a_name", ""))
            b = normalize_name(ep.get("drug_b_name", ""))
            if not a or not b:
                continue
            if a == b:
                continue
            key = (a, b) if a <= b else (b, a)
            if key in seen:
                continue
            seen.add(key)

            uid_a, uid_b = resolve_drug(a, (by_slug, by_name)), resolve_drug(
                b, (by_slug, by_name)
            )
            if uid_a is None:
                unresolved_a += 1
            if uid_b is None:
                unresolved_b += 1

            insert_rows.append(
                (
                    ep.get("id"),
                    uid_a,
                    uid_b,
                    a,
                    b,
                    ep.get("title", "") or "",
                    (ep.get("severity") or "unknown").lower(),
                    ep.get("mechanism_explanation", "") or "",
                    ep.get("clinical_action", "") or "",
                    "external",
                    p.get("source", "") or "",
                    p.get("source_doi"),
                    p.get("import_batch"),
                    [],
                    {
                        "drug_a_name": ep.get("drug_a_name"),
                        "drug_b_name": ep.get("drug_b_name"),
                    },
                )
            )

        print(f"unique pairs: {len(insert_rows):,}")
        print(f"unresolved drug_a: {unresolved_a:,}")
        print(f"unresolved drug_b: {unresolved_b:,}")
        both = sum(1 for r in insert_rows if r[1] is None and r[2] is None)
        usable = sum(1 for r in insert_rows if r[1] is not None and r[2] is not None)
        print(f"pairs with NEITHER endpoint resolved: {both:,}")
        print(f"pairs usable for pairwise lookup (both resolved): {usable:,}")

        if args.dry_run:
            print("\n--dry-run: nothing written")
            return 0

        async with conn.transaction():
            await conn.executemany(
                """
                INSERT INTO drug_drug_interactions (
                    id, drug_a_id, drug_b_id, drug_a_slug, drug_b_slug,
                    title, severity, mechanism_explanation, clinical_action,
                    curation_status, source, source_doi, import_batch,
                    evidence_ids, extra
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                ON CONFLICT (id) DO UPDATE SET
                    drug_a_id = EXCLUDED.drug_a_id,
                    drug_b_id = EXCLUDED.drug_b_id,
                    title = EXCLUDED.title,
                    severity = EXCLUDED.severity,
                    mechanism_explanation = EXCLUDED.mechanism_explanation,
                    clinical_action = EXCLUDED.clinical_action
                """,
                insert_rows,
            )
        print(f"\ninserted/updated {len(insert_rows):,} rows into drug_drug_interactions")

        count = await conn.fetchval("SELECT count(*) FROM drug_drug_interactions")
        print(f"table now holds {count:,} rows")

        if not args.keep_workflows:
            deleted = await conn.execute(
                "DELETE FROM curator_workflows WHERE entity_type = 'Interaction'"
            )
            print(f"deleted from curator_workflows: {deleted}")
            left = await conn.fetchval(
                "SELECT count(*) FROM curator_workflows WHERE entity_type = 'Interaction'"
            )
            print(f"curator_workflows Interaction rows remaining: {left}")
    finally:
        await conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
