#!/usr/bin/env python3
"""
PrimeKG Parser & Normalizer
Parses the raw PrimeKG files and splits them into normalized nodes and edges.

PrimeKG files:
- kg.csv: Main graph (relation, x_id, x_type, x_name, y_id, y_type, y_name)
- nodes.csv: Node metadata (node_id, node_type, node_name, node_source)
- edges.csv: Edge list (relation, x_index, y_index)

Output:
- nodes_drugs.parquet
- nodes_targets.parquet
- nodes_diseases.parquet
- nodes_pathways.parquet
- nodes_effects.parquet
- edges_all.parquet (all edges with normalized types)

Usage:
    python scripts/ingestion/parse_primekg.py [--input data/primekg/] [--output data/primekg/parsed/]
"""

import argparse
import sys
import re
from pathlib import Path
from uuid import UUID, uuid5

import pandas as pd
from tqdm import tqdm

# Default paths
DEFAULT_INPUT_DIR = Path(__file__).parent.parent.parent / "data" / "primekg"
DEFAULT_OUTPUT = Path(__file__).parent.parent.parent / "data" / "primekg" / "parsed"

# UUID namespace for deterministic IDs
PRIMEKG_NAMESPACE = UUID("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")

# Node type mapping (PrimeKG -> FarmacoGraph)
NODE_TYPE_MAP = {
    "drug": "Drug",
    "protein": "Target",
    "gene/protein": "Target",
    "pathway": "Pathway",
    "biological_process": "BiologicalProcess",
    "molecular_function": "MolecularFunction",
    "cellular_component": "CellularComponent",
    "disease": "Disease",
    "effect/phenotype": "AdverseEffect",
    "phenotype": "AdverseEffect",
    "anatomy": "Anatomy",
}

# Relationship type mapping (PrimeKG -> FarmacoGraph)
RELATION_MAP = {
    "drug_protein": "TARGETS",
    "protein_pathway": "PART_OF_PATHWAY",
    "pathway_pathway": "PRECEDES",
    "protein_protein": "INTERACTS_WITH_PROTEIN",
    "drug_drug": "INTERACTS_WITH",
    "indication": "TREATS",
    "contraindication": "CONTRAINDICATED_IN",
    "drug_effect": "CAUSES_ADVERSE_EFFECT",
    "disease_phenotype": "PRESENTS_PHENOTYPE",
    "disease_gene": "ASSOCIATED_WITH_GENE",
    "off_label_use": "OFF_LABEL_USE",
    "biomarker": "HAS_BIOMARKER",
}


def generate_uuid(entity_type: str, entity_id: str) -> str:
    """Generate deterministic UUIDv5 for an entity."""
    key = f"{entity_type}:{entity_id}"
    return str(uuid5(PRIMEKG_NAMESPACE, key))


def normalize_slug(name: str) -> str:
    """Convert name to URL-friendly slug."""
    if not name:
        return ""
    slug = str(name).lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug[:100]  # Limit length


def load_nodes(input_dir: Path) -> pd.DataFrame:
    """Load nodes.csv."""
    nodes_path = input_dir / "nodes.csv"
    print(f"\nLoading {nodes_path}...")
    
    df = pd.read_csv(nodes_path)
    print(f"  Loaded {len(df):,} nodes")
    print(f"  Columns: {list(df.columns)}")
    
    # Show node type distribution
    print("\n  Node types:")
    for node_type, count in df["node_type"].value_counts().items():
        fg_type = NODE_TYPE_MAP.get(node_type, node_type)
        print(f"    {node_type} -> {fg_type}: {count:,}")
    
    return df


def load_edges(input_dir: Path) -> pd.DataFrame:
    """Load kg.csv (main graph with full node info)."""
    kg_path = input_dir / "kg.csv"
    print(f"\nLoading {kg_path}...")
    
    # Load in chunks due to large file size
    chunks = []
    for chunk in tqdm(pd.read_csv(kg_path, chunksize=1000000), desc="Loading kg.csv"):
        chunks.append(chunk)
    
    df = pd.concat(chunks, ignore_index=True)
    print(f"  Loaded {len(df):,} edges")
    print(f"  Columns: {list(df.columns)}")
    
    # Show relation type distribution
    print("\n  Relation types:")
    for rel, count in df["relation"].value_counts().items():
        fg_rel = RELATION_MAP.get(rel, rel.upper())
        print(f"    {rel} -> {fg_rel}: {count:,}")
    
    return df


def parse_nodes(nodes_df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Parse and normalize nodes by type."""
    print("\nParsing nodes...")
    
    parsed_nodes = {}
    
    for raw_type, fg_type in NODE_TYPE_MAP.items():
        type_nodes = nodes_df[nodes_df["node_type"] == raw_type].copy()
        
        if len(type_nodes) == 0:
            continue
        
        print(f"  Processing {fg_type}: {len(type_nodes):,} nodes")
        
        # Generate UUIDs
        type_nodes["id"] = type_nodes.apply(
            lambda row: generate_uuid(fg_type, str(row["node_id"])), axis=1
        )
        
        # Create slugs from names
        type_nodes["slug"] = type_nodes["node_name"].apply(
            lambda x: normalize_slug(x) if pd.notna(x) else normalize_slug(str(row.get("node_id", "")))
        )
        
        # Rename columns
        type_nodes = type_nodes.rename(columns={
            "node_name": "name",
            "node_id": "raw_id",
            "node_source": "source_db",
        })
        
        # Add FarmacoGraph fields
        type_nodes["farmacograph_type"] = fg_type
        type_nodes["status"] = "published"
        type_nodes["source"] = "primekg"
        
        # Select final columns
        type_nodes = type_nodes[[
            "id", "slug", "name", "raw_id", "source_db", 
            "farmacograph_type", "status", "source"
        ]].copy()
        
        parsed_nodes[fg_type] = type_nodes
    
    return parsed_nodes


def parse_edges(edges_df: pd.DataFrame) -> pd.DataFrame:
    """Parse and normalize edges."""
    print("\nParsing edges...")
    
    edges = edges_df.copy()
    
    # Map relationship types
    edges["farmacograph_relation"] = edges["relation"].map(
        lambda r: RELATION_MAP.get(r, r.upper() if r else "UNKNOWN")
    )
    
    # Generate source and target UUIDs
    print("  Generating source UUIDs...")
    edges["source_type"] = edges["x_type"].map(lambda t: NODE_TYPE_MAP.get(t, "Unknown"))
    edges["source_id"] = edges.apply(
        lambda row: generate_uuid(row["source_type"], str(row["x_id"])),
        axis=1
    )
    
    print("  Generating target UUIDs...")
    edges["target_type"] = edges["y_type"].map(lambda t: NODE_TYPE_MAP.get(t, "Unknown"))
    edges["target_id"] = edges.apply(
        lambda row: generate_uuid(row["target_type"], str(row["y_id"])),
        axis=1
    )
    
    # Add source names for reference
    edges["source_name"] = edges["x_name"]
    edges["target_name"] = edges["y_name"]
    
    # Select relevant columns
    edges = edges[[
        "source_id", "target_id", 
        "source_name", "target_name",
        "source_type", "target_type",
        "relation", "farmacograph_relation", "display_relation"
    ]].copy()
    
    # Add source field
    edges["source"] = "primekg"
    
    print(f"  Total edges: {len(edges):,}")
    
    return edges


def save_parquet(nodes: dict[str, pd.DataFrame], edges: pd.DataFrame, output_dir: Path):
    """Save parsed data as Parquet files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\nSaving to {output_dir}...")
    
    # Save nodes
    for node_type, df in nodes.items():
        output_path = output_dir / f"nodes_{node_type.lower()}.parquet"
        df.to_parquet(output_path, index=False)
        print(f"  ✓ {output_path.name}: {len(df):,} rows")
    
    # Save edges
    edges_path = output_dir / "edges_all.parquet"
    edges.to_parquet(edges_path, index=False)
    print(f"  ✓ {edges_path.name}: {len(edges):,} rows")
    
    # Save summary
    summary = {
        "total_nodes": sum(len(df) for df in nodes.values()),
        "total_edges": len(edges),
        "node_types": {k: len(v) for k, v in nodes.items()},
        "edge_types": edges["farmacograph_relation"].value_counts().to_dict(),
    }
    
    import json
    summary_path = output_dir / "ingestion_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n✓ Summary saved to {summary_path}")
    
    return summary


def main():
    parser = argparse.ArgumentParser(description="Parse and normalize PrimeKG data")
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Input directory with PrimeKG files (default: {DEFAULT_INPUT_DIR})"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output directory (default: {DEFAULT_OUTPUT})"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("PrimeKG Parser & Normalizer")
    print("=" * 60)
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    
    if not args.input.exists():
        print(f"\n✗ Input directory not found: {args.input}")
        return 1
    
    kg_file = args.input / "kg.csv"
    if not kg_file.exists():
        print(f"\n✗ kg.csv not found in {args.input}")
        print("  Run download_primekg.py first")
        return 1
    
    # Load data
    nodes_df = load_nodes(args.input)
    edges_df = load_edges(args.input)
    
    # Parse nodes
    parsed_nodes = parse_nodes(nodes_df)
    
    # Parse edges
    parsed_edges = parse_edges(edges_df)
    
    # Save
    summary = save_parquet(parsed_nodes, parsed_edges, args.output)
    
    print("\n" + "=" * 60)
    print("✓ Parsing complete!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  Total nodes: {summary['total_nodes']:,}")
    print(f"  Total edges: {summary['total_edges']:,}")
    
    print("\nNext steps:")
    print("  1. Initialize Neo4j schema:")
    print("     python scripts/ingestion/init_neo4j_schema.py")
    print("  2. Run ETL to Neo4j:")
    print("     python scripts/ingestion/etl_primekg_to_neo4j.py")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
