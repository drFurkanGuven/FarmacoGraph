#!/usr/bin/env python3
"""
Enrich PrimeKG nodes in Neo4j with human-readable labels, names, and external IDs.
"""

import os
from pathlib import Path
import pandas as pd
from neo4j import GraphDatabase
from tqdm import tqdm

DEFAULT_INPUT_DIR = Path(__file__).parent.parent.parent / "data" / "primekg" / "parsed"
URI = os.environ.get("FG_NEO4J_URI", "bolt://neo4j:7687")
USER = os.environ.get("FG_NEO4J_USER", "neo4j")
PASSWORD = os.environ.get("FG_NEO4J_PASSWORD", "farmacograph")

def main():
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    parquet_files = list(DEFAULT_INPUT_DIR.glob("nodes_*.parquet"))
    print(f"Found {len(parquet_files)} node files to enrich...")

    label_map = {
        "drug": "Drug",
        "disease": "Disease",
        "pathway": "Pathway",
        "target": "Target",
        "adverseeffect": "AdverseEffect",
        "biologicalprocess": "BiologicalProcess",
        "cellularcomponent": "CellularComponent",
        "molecularfunction": "MolecularFunction",
        "anatomy": "Anatomy",
    }

    with driver.session() as session:
        for pfile in parquet_files:
            raw_type = pfile.stem.replace("nodes_", "").lower()
            node_type = label_map.get(raw_type, raw_type.capitalize())
            df = pd.read_parquet(pfile)
            print(f"Enriching {node_type} ({len(df):,} nodes)...")
            
            # Choose properties based on type
            if node_type == "Drug":
                cypher = f"""
                UNWIND $batch AS row
                MATCH (n:{node_type} {{id: row.id}})
                SET n.name = row.name,
                    n.label = row.name,
                    n.generic_name = row.name,
                    n.external_id = row.raw_id,
                    n.source_db = row.source_db
                """
            else:
                cypher = f"""
                UNWIND $batch AS row
                MATCH (n:{node_type} {{id: row.id}})
                SET n.name = row.name,
                    n.label = row.name,
                    n.external_id = row.raw_id,
                    n.source_db = row.source_db
                """

            batch_size = 10000
            for i in tqdm(range(0, len(df), batch_size), desc=f"Updating {node_type}"):
                batch = df.iloc[i:i + batch_size].to_dict("records")
                session.run(cypher, batch=batch)

    print("\nNode enrichment complete!")
    driver.close()

if __name__ == "__main__":
    main()
