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


def iter_edge_chunks(input_dir: Path, chunk_size: int = 1_000_000):
    """Yield kg.csv in row chunks without ever materialising the whole file.

    kg.csv holds 8.1M edges. Loading it into a single DataFrame peaks above
    2 GB before normalisation, and parse_edges then adds UUID/name columns on
    top of that. On a small host that is an out-of-memory kill, so edges are
    streamed chunk by chunk straight into Parquet row groups.
    """
    kg_path = input_dir / "kg.csv"
    print(f"\nStreaming {kg_path}...")
    for chunk in tqdm(pd.read_csv(kg_path, chunksize=chunk_size), desc="Reading kg.csv"):
        yield chunk


def build_uuid_lookup(nodes: dict[str, pd.DataFrame]) -> dict[str, dict[str, str]]:
    """Map (FarmacoGraph type, PrimeKG node_id) -> generated UUID.

    The dataset has 129,375 distinct nodes but 8.1M edges, so resolving every
    endpoint with a per-row ``generate_uuid`` call is ~16.2M UUIDv5 hashes
    through a row-wise ``DataFrame.apply``. Building the lookup once turns
    that into 129,375 hashes plus vectorised lookups.
    """
    lookup: dict[str, dict[str, str]] = {}
    for df in nodes.values():
        if df.empty:
            continue
        fg_type = str(df["farmacograph_type"].iloc[0])
        lookup[fg_type] = dict(zip(df["raw_id"].astype(str), df["id"].astype(str)))
    return lookup


def resolve_node_ids(
    raw_ids: pd.Series,
    raw_types: pd.Series,
    lookup: dict[str, dict[str, str]],
) -> pd.Series:
    """Vectorised (raw_id, raw_type) -> UUID resolution, per PrimeKG type.

    Masking per type keeps each temporary proportional to one type's rows
    rather than the whole chunk.
    """
    out = pd.Series(pd.NA, index=raw_ids.index, dtype=object)

    for raw_type, fg_type in NODE_TYPE_MAP.items():
        mask = raw_types.eq(raw_type)
        if not mask.any():
            continue
        table = lookup.get(fg_type)
        if not table:
            continue
        out[mask] = raw_ids[mask].astype(str).map(table)

    missing = out.isna()
    if missing.any():
        # Types absent from NODE_TYPE_MAP (e.g. PrimeKG "exposure") still need a
        # deterministic id or the ETL drops the edge on the node MATCH.
        out[missing] = [
            generate_uuid(NODE_TYPE_MAP.get(str(t), "Unknown"), str(i))
            for i, t in zip(raw_ids[missing], raw_types[missing])
        ]

    return out


def parse_edge_chunk(
    chunk: pd.DataFrame,
    lookup: dict[str, dict[str, str]],
) -> pd.DataFrame:
    """Normalise one kg.csv chunk into FarmacoGraph edge columns."""
    edges = pd.DataFrame(index=chunk.index)

    edges["source_type"] = chunk["x_type"].map(lambda t: NODE_TYPE_MAP.get(t, "Unknown"))
    edges["target_type"] = chunk["y_type"].map(lambda t: NODE_TYPE_MAP.get(t, "Unknown"))
    edges["source_id"] = resolve_node_ids(chunk["x_id"], chunk["x_type"], lookup)
    edges["target_id"] = resolve_node_ids(chunk["y_id"], chunk["y_type"], lookup)
    edges["relation"] = chunk["relation"]
    edges["farmacograph_relation"] = chunk["relation"].map(
        lambda r: RELATION_MAP.get(r, r.upper() if r else "UNKNOWN")
    )
    edges["display_relation"] = chunk["display_relation"]
    edges["source"] = "primekg"

    return edges[
        [
            "source_id",
            "target_id",
            "source_type",
            "target_type",
            "relation",
            "farmacograph_relation",
            "display_relation",
            "source",
        ]
    ]



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
        # PrimeKG drugs are published so learners can discover the full
        # formulary, but they are NOT curator-authored. curation_status keeps
        # that distinction queryable: "curated" (Studio-authored) vs
        # "external" (PrimeKG, unvetted). "draft" is reserved for
        # curator-authored packages that have not been approved yet.
        #
        # NOTE: no `module` is assigned here. PrimeKG carries no clinical module
        # field (drugs are all node_source=DrugBank), and 74% of drugs have no
        # `indication` edge at all, so a trustworthy module cannot be derived.
        # Drugs land in the API's explicit "unclassified" bucket instead.
        type_nodes["status"] = "published"
        type_nodes["curation_status"] = "external"
        type_nodes["source"] = "primekg"

        # Select final columns
        type_nodes = type_nodes[[
            "id", "slug", "name", "raw_id", "source_db",
            "farmacograph_type", "status", "curation_status", "source"
        ]].copy()
        
        parsed_nodes[fg_type] = type_nodes
    
    return parsed_nodes


def save_parquet(nodes: dict[str, pd.DataFrame], output_dir: Path):
    """Save parsed node types as Parquet files."""
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nSaving nodes to {output_dir}...")

    for node_type, df in nodes.items():
        output_path = output_dir / f"nodes_{node_type.lower()}.parquet"
        df.to_parquet(output_path, index=False)
        print(f"  \u2713 {output_path.name}: {len(df):,} rows")


def stream_edges_to_parquet(
    input_dir: Path,
    output_path: Path,
    lookup: dict[str, dict[str, str]],
    chunk_size: int = 1_000_000,
) -> dict[str, int]:
    """Normalise and write edges in one streaming pass.

    Each kg.csv chunk is normalised and appended as a Parquet row group, so peak
    memory stays at one chunk instead of the full 8.1M-row table. Returns the
    edge-type counts collected on the way through.
    """
    import pyarrow as pa
    import pyarrow.parquet as pq

    print("\nParsing & writing edges (streaming)...")

    writer = None
    total = 0
    edge_types: dict[str, int] = {}

    for chunk in iter_edge_chunks(input_dir, chunk_size=chunk_size):
        edges = parse_edge_chunk(chunk, lookup)

        for rel, count in edges["farmacograph_relation"].value_counts().items():
            edge_types[rel] = edge_types.get(rel, 0) + int(count)

        total += len(edges)
        table = pa.Table.from_pandas(edges, preserve_index=False)
        if writer is None:
            writer = pq.ParquetWriter(output_path, table.schema, compression="snappy")
        writer.write_table(table)
        del table, edges, chunk

    if writer is not None:
        writer.close()
        print(f"  \u2713 {output_path.name}: {total:,} rows")

    return {"total_edges": total, "edge_types": edge_types}

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
    
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=250_000,
        help=(
            "Rows per kg.csv chunk. Memory peak scales with this: 1M peaked at "
            "1.46 GB, 250K fits in a small host. Lower = less RAM, slower."
        ),
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
    
    # Nodes first: the generated UUIDs become the edge lookup table.
    nodes_df = load_nodes(args.input)
    parsed_nodes = parse_nodes(nodes_df)
    save_parquet(parsed_nodes, args.output)

    lookup = build_uuid_lookup(parsed_nodes)
    print(f"  UUID lookup tables: {len(lookup):,} types, "
          f"{sum(len(v) for v in lookup.values()):,} nodes")

    # Edges streamed straight to Parquet, never fully in memory.
    edge_summary = stream_edges_to_parquet(
        args.input, args.output / "edges_all.parquet", lookup, chunk_size=args.chunk_size
    )

    summary = {
        "total_nodes": sum(len(df) for df in parsed_nodes.values()),
        "total_edges": edge_summary["total_edges"],
        "node_types": {k: len(v) for k, v in parsed_nodes.items()},
        "edge_types": edge_summary["edge_types"],
    }

    import json

    summary_path = args.output / "ingestion_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\n✓ Summary saved to {summary_path}")

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
