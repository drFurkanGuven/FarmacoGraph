#!/usr/bin/env python3
"""
PrimeKG to Neo4j ETL Pipeline
High-throughput batch ingestion of parsed PrimeKG data into Neo4j.

Uses chunked UNWIND batches (10,000/batch) for optimal performance.

Usage:
    python scripts/ingestion/etl_primekg_to_neo4j.py [--input data/primekg/parsed/] [--batch-size 10000]
"""

import argparse
import sys
from pathlib import Path
from typing import Iterator

import pandas as pd
from neo4j import GraphDatabase
from tqdm import tqdm

# Default paths
DEFAULT_INPUT_DIR = Path(__file__).parent.parent.parent / "data" / "primekg" / "parsed"

import os

# Neo4j connection
DEFAULT_URI = os.environ.get("FG_NEO4J_URI", "bolt://localhost:7688")
DEFAULT_USER = os.environ.get("FG_NEO4J_USER", "neo4j")
DEFAULT_PASSWORD = os.environ.get("FG_NEO4J_PASSWORD", "farmacograph")

# Batch size for UNWIND operations
DEFAULT_BATCH_SIZE = 10000


def batch_iter(df: pd.DataFrame, batch_size: int) -> Iterator[pd.DataFrame]:
    """Yield batches of a DataFrame."""
    for i in range(0, len(df), batch_size):
        yield df.iloc[i:i + batch_size]


def ingest_nodes(driver, node_type: str, df: pd.DataFrame, batch_size: int) -> int:
    """Ingest nodes of a specific type into Neo4j."""
    if df.empty:
        return 0
    
    label = node_type
    total_ingested = 0
    
    # Cypher query for MERGE nodes
    cypher = f"""
    UNWIND $batch AS row
    MERGE (n:{label} {{id: row.id}})
    ON CREATE SET
        n.slug = row.slug,
        n.name = row.raw_id,
        n.status = row.status,
        n.source = row.source,
        n.external_ids = row.external_ids,
        n.farmacograph_type = row.farmacograph_type
    """
    
    with driver.session() as session:
        for batch in tqdm(
            batch_iter(df, batch_size),
            total=(len(df) + batch_size - 1) // batch_size,
            desc=f"Ingesting {label} nodes",
            unit="batch"
        ):
            batch_data = batch.to_dict("records")
            session.run(cypher, batch=batch_data)
            total_ingested += len(batch)
    
    return total_ingested


def ingest_edges(driver, df: pd.DataFrame, batch_size: int, clinical_only: bool = False) -> int:
    """Ingest edges into Neo4j using indexed labels and canonical directions."""
    if df.empty:
        return 0

    total_ingested = 0

    # Canonical edge configurations: (relation_name, source_type, target_type, cypher_rel_type)
    canonical_configs = [
        ("TARGETS", "Drug", "Target", "TARGETS"),
        ("TREATS", "Drug", "Disease", "TREATS"),
        ("CONTRAINDICATED_IN", "Drug", "Disease", "CONTRAINDICATED_IN"),
        ("CAUSES_ADVERSE_EFFECT", "Drug", "AdverseEffect", "CAUSES_ADVERSE_EFFECT"),
        ("PATHWAY_PROTEIN", "Target", "Pathway", "PART_OF_PATHWAY"),
        ("PRECEDES", "Pathway", "Pathway", "PRECEDES"),
        ("INTERACTS_WITH", "Drug", "Drug", "INTERACTS_WITH"),
        ("INTERACTS_WITH_PROTEIN", "Target", "Target", "INTERACTS_WITH_PROTEIN"),
        ("DISEASE_PROTEIN", "Disease", "Target", "ASSOCIATED_WITH_GENE"),
        ("DISEASE_PHENOTYPE_POSITIVE", "Disease", "AdverseEffect", "PRESENTS_PHENOTYPE"),
        ("BIOPROCESS_PROTEIN", "Target", "BiologicalProcess", "INVOLVED_IN_PROCESS"),
        ("MOLFUNC_PROTEIN", "Target", "MolecularFunction", "HAS_MOLECULAR_FUNCTION"),
        ("CELLCOMP_PROTEIN", "Target", "CellularComponent", "LOCATED_IN_COMPONENT"),
        ("ANATOMY_PROTEIN_PRESENT", "Target", "Anatomy", "EXPRESSED_IN_ANATOMY"),
    ]

    clinical_rel_names = {
        "TARGETS", "TREATS", "CONTRAINDICATED_IN", "CAUSES_ADVERSE_EFFECT",
        "PATHWAY_PROTEIN", "PRECEDES", "INTERACTS_WITH", "INTERACTS_WITH_PROTEIN",
        "DISEASE_PROTEIN", "DISEASE_PHENOTYPE_POSITIVE"
    }

    for rel_name, s_type, t_type, cypher_rel in canonical_configs:
        if clinical_only and rel_name not in clinical_rel_names:
            continue

        # Filter to matching rows
        mask = (
            (df["farmacograph_relation"] == rel_name)
            & (df["source_type"] == s_type)
            & (df["target_type"] == t_type)
        )
        group = df[mask]

        if group.empty:
            continue

        # For symmetric relations (Drug-Drug, Target-Target), filter to canonical pair (source_id < target_id)
        if s_type == t_type:
            group = group[group["source_id"] < group["target_id"]]

        extra_set = ""
        if cypher_rel == "TREATS":
            extra_set = ", r.approval_status = 'fda_approved'"
        elif cypher_rel == "INTERACTS_WITH":
            extra_set = ", r.severity = 'major'"

        cypher = f"""
        UNWIND $batch AS row
        MATCH (a:{s_type} {{id: row.source_id}})
        MATCH (b:{t_type} {{id: row.target_id}})
        MERGE (a)-[r:{cypher_rel}]->(b)
        ON CREATE SET r.source = 'primekg'{extra_set}
        """

        with driver.session() as session:
            for batch in tqdm(
                batch_iter(group, batch_size),
                total=(len(group) + batch_size - 1) // batch_size,
                desc=f"Ingesting {cypher_rel} ({s_type}->{t_type})",
                unit="batch"
            ):
                batch_data = batch[["source_id", "target_id"]].to_dict("records")
                try:
                    session.run(cypher, batch=batch_data)
                    total_ingested += len(batch)
                except Exception as e:
                    print(f"  ⚠ Error ingesting batch: {e}")

    return total_ingested


def main():
    parser = argparse.ArgumentParser(description="Ingest PrimeKG data into Neo4j")
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Input directory with Parquet files (default: {DEFAULT_INPUT_DIR})"
    )
    parser.add_argument("--uri", default=DEFAULT_URI, help=f"Neo4j URI (default: {DEFAULT_URI})")
    parser.add_argument("--user", default=DEFAULT_USER, help=f"Neo4j user (default: {DEFAULT_USER})")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Neo4j password")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help=f"Batch size (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--nodes-only", action="store_true", help="Only ingest nodes")
    parser.add_argument("--edges-only", action="store_true", help="Only ingest edges")
    parser.add_argument("--clinical-only", action="store_true", help="Only ingest clinical & pharmacological edges (skips 3M anatomy edges)")
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("PrimeKG to Neo4j ETL Pipeline")
    print("=" * 60)
    print(f"Input: {args.input}")
    print(f"Neo4j: {args.uri}")
    print(f"Batch size: {args.batch_size:,}")
    
    if not args.input.exists():
        print(f"\n✗ Input directory not found: {args.input}")
        print("  Run parse_primekg.py first")
        return 1
    
    # Connect to Neo4j
    print(f"\nConnecting to Neo4j at {args.uri}...")
    try:
        driver = GraphDatabase.driver(args.uri, auth=(args.user, args.password))
        driver.verify_connectivity()
        print("✓ Connected to Neo4j")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return 1
    
    total_nodes = 0
    total_edges = 0
    
    # Ingest nodes
    if not args.edges_only:
        print("\n" + "-" * 40)
        print("INGESTING NODES")
        print("-" * 40)
        
        node_files = list(args.input.glob("nodes_*.parquet"))
        
        for node_file in node_files:
            # Extract node type from filename
            node_type = node_file.stem.replace("nodes_", "").title()
            
            # Map filename to label
            type_map = {
                "Drug": "Drug",
                "Target": "Target",
                "Disease": "Disease",
                "Pathway": "Pathway",
                "Biologicalprocess": "BiologicalProcess",
                "Molecularfunction": "MolecularFunction",
                "Cellularcomponent": "CellularComponent",
                "Adverseeffect": "AdverseEffect",
                "Anatomy": "Anatomy",
            }
            
            label = type_map.get(node_type, node_type)
            
            print(f"\nLoading {node_file.name}...")
            df = pd.read_parquet(node_file)
            
            count = ingest_nodes(driver, label, df, args.batch_size)
            total_nodes += count
            print(f"✓ Ingested {count:,} {label} nodes")
    
    # Ingest edges
    if not args.nodes_only:
        print("\n" + "-" * 40)
        print("INGESTING EDGES")
        print("-" * 40)
        
        edges_file = args.input / "edges_all.parquet"
        
        if edges_file.exists():
            print(f"\nLoading {edges_file.name}...")
            edges_df = pd.read_parquet(edges_file)
            
            count = ingest_edges(driver, edges_df, args.batch_size, clinical_only=args.clinical_only)
            total_edges += count
            print(f"✓ Ingested {count:,} edges")
        else:
            print(f"\n✗ Edges file not found: {edges_file}")
    
    driver.close()
    
    print("\n" + "=" * 60)
    print("✓ ETL Complete!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Total nodes ingested: {total_nodes:,}")
    print(f"  Total edges ingested: {total_edges:,}")
    
    print("\nNext step: Run verify_ingestion.py to validate")
    print("  python scripts/ingestion/verify_ingestion.py")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
