#!/usr/bin/env python3
"""
PrimeKG Ingestion Verification
Validates the ingested data and generates summary reports.

Usage:
    python scripts/ingestion/verify_ingestion.py [--uri bolt://localhost:7688]
"""

import argparse
import sys
from neo4j import GraphDatabase

import os

# Default Neo4j connection
DEFAULT_URI = os.environ.get("FG_NEO4J_URI", "bolt://neo4j:7687")
DEFAULT_USER = os.environ.get("FG_NEO4J_USER", "neo4j")
DEFAULT_PASSWORD = os.environ.get("FG_NEO4J_PASSWORD", "farmacograph")

# Expected counts from PrimeKG (approximate)
EXPECTED_COUNTS = {
    "Drug": 7000,
    "Target": 20000,
    "Disease": 17000,
    "Pathway": 2000,
    "AdverseEffect": 15000,
}

# Validation queries
VALIDATION_QUERIES = [
    {
        "name": "Node counts by label",
        "query": """
            MATCH (n)
            RETURN head(labels(n)) as label, count(*) as count
            ORDER BY count DESC
        """,
    },
    {
        "name": "Edge counts by type",
        "query": """
            MATCH ()-[r]->()
            RETURN type(r) as relationshipType, count(*) as count
            ORDER BY count DESC
        """,
    },
    {
        "name": "Drug-Treats-Disease paths",
        "query": """
            MATCH (d:Drug)-[r:TREATS]->(dis:Disease)
            RETURN count(r) as count
        """,
    },
    {
        "name": "Drug-Targets relationships",
        "query": """
            MATCH (d:Drug)-[r:TARGETS]->(t:Target)
            RETURN count(r) as count
        """,
    },
    {
        "name": "Drug-Drug interactions",
        "query": """
            MATCH (d1:Drug)-[r:INTERACTS_WITH]-(d2:Drug)
            RETURN count(r) as count
        """,
    },
    {
        "name": "Drugs with adverse effects",
        "query": """
            MATCH (d:Drug)-[r:CAUSES_ADVERSE_EFFECT]->(a:AdverseEffect)
            RETURN count(DISTINCT d) as drugs_with_effects, count(r) as total_effects
        """,
    },
    {
        "name": "Sample drug pathway (Metoprolol or similar beta-blocker)",
        "query": """
            MATCH (d:Drug)-[:TARGETS]->(t:Target)-[:PART_OF_PATHWAY]->(p:Pathway)
            WHERE d.name CONTAINS 'metoprolol' OR d.name CONTAINS 'propranolol' OR d.name CONTAINS 'DB00264'
            RETURN d.name as drug, t.name as target, p.name as pathway
            LIMIT 5
        """,
    },
]


def run_validation(driver):
    """Run validation queries and display results."""
    print("\n" + "=" * 60)
    print("PRIMEKG INGESTION VERIFICATION")
    print("=" * 60)
    
    results = {}
    
    with driver.session() as session:
        for validation in VALIDATION_QUERIES:
            name = validation["name"]
            query = validation["query"]
            
            print(f"\n{name}:")
            print("-" * 40)
            
            try:
                result = session.run(query)
                records = list(result)
                
                if not records:
                    print("  (no results)")
                    continue
                
                # Check if it's a key-value result
                if len(records[0].keys()) == 2:
                    for record in records:
                        key = list(record.values())[0]
                        value = list(record.values())[1]
                        if isinstance(value, int):
                            print(f"  {key}: {value:,}")
                            results[key] = value
                        else:
                            print(f"  {key}: {value}")
                else:
                    # Tabular result
                    for record in records[:10]:
                        values = [str(v) for v in record.values()]
                        print(f"  {' | '.join(values)}")
                    if len(records) > 10:
                        print(f"  ... and {len(records) - 10} more rows")
                
            except Exception as e:
                print(f"  ⚠ Error: {e}")
    
    return results


def check_data_quality(driver):
    """Run data quality checks."""
    print("\n" + "=" * 60)
    print("DATA QUALITY CHECKS")
    print("=" * 60)
    
    checks = [
        {
            "name": "Orphan nodes (no relationships)",
            "query": """
                MATCH (n)
                WHERE NOT (n)--()
                RETURN labels(n)[0] as label, count(n) as count
                ORDER BY count DESC
                LIMIT 10
            """,
        },
        {
            "name": "Nodes without name property",
            "query": """
                MATCH (n)
                WHERE n.name IS NULL OR n.name = ''
                RETURN labels(n)[0] as label, count(n) as count
                ORDER BY count DESC
                LIMIT 10
            """,
        },
        {
            "name": "Duplicate node IDs",
            "query": """
                MATCH (n)
                WITH n.id as id, labels(n)[0] as label, count(*) as count
                WHERE count > 1
                RETURN label, id, count
                ORDER BY count DESC
                LIMIT 10
            """,
        },
    ]
    
    with driver.session() as session:
        for check in checks:
            print(f"\n{check['name']}:")
            print("-" * 40)
            
            try:
                result = session.run(check["query"])
                records = list(result)
                
                if not records:
                    print("  ✓ No issues found")
                else:
                    for record in records:
                        values = [str(v) for v in record.values()]
                        print(f"  ⚠ {' | '.join(values)}")
                
            except Exception as e:
                print(f"  ⚠ Error: {e}")


def generate_summary(driver) -> dict:
    """Generate summary statistics."""
    summary = {}
    
    with driver.session() as session:
        # Total nodes
        result = session.run("MATCH (n) RETURN count(n) as count")
        summary["total_nodes"] = result.single()["count"]
        
        # Total edges
        result = session.run("MATCH ()-[r]->() RETURN count(r) as count")
        summary["total_edges"] = result.single()["count"]
        
        # Node counts by label
        result = session.run("""
            MATCH (n)
            RETURN head(labels(n)) as label, count(*) as count
        """)
        summary["nodes_by_label"] = {record["label"]: record["count"] for record in result if record["label"]}

        # Edge counts by type
        result = session.run("""
            MATCH ()-[r]->()
            RETURN type(r) as relationshipType, count(*) as count
        """)
        summary["edges_by_type"] = {record["relationshipType"]: record["count"] for record in result}
    
    return summary


def main():
    parser = argparse.ArgumentParser(description="Verify PrimeKG ingestion")
    parser.add_argument("--uri", default=DEFAULT_URI, help=f"Neo4j URI (default: {DEFAULT_URI})")
    parser.add_argument("--user", default=DEFAULT_USER, help=f"Neo4j user (default: {DEFAULT_USER})")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Neo4j password")
    parser.add_argument("--full", action="store_true", help="Run full validation including quality checks")
    
    args = parser.parse_args()
    
    print("\nConnecting to Neo4j...")
    try:
        driver = GraphDatabase.driver(args.uri, auth=(args.user, args.password))
        driver.verify_connectivity()
        print("✓ Connected")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return 1
    
    # Run validation
    results = run_validation(driver)
    
    # Run quality checks if requested
    if args.full:
        check_data_quality(driver)
    
    # Generate summary
    summary = generate_summary(driver)
    
    print("\n" + "=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)
    print(f"\nTotal nodes: {summary['total_nodes']:,}")
    print(f"Total edges: {summary['total_edges']:,}")
    
    print("\nNodes by label:")
    for label, count in sorted(summary["nodes_by_label"].items(), key=lambda x: -x[1]):
        expected = EXPECTED_COUNTS.get(label, 0)
        status = "✓" if count >= expected * 0.8 else "⚠"
        print(f"  {status} {label}: {count:,}")
    
    print("\nEdges by type:")
    for rel_type, count in sorted(summary["edges_by_type"].items(), key=lambda x: -x[1]):
        print(f"  • {rel_type}: {count:,}")
    
    driver.close()
    
    print("\n" + "=" * 60)
    print("✓ Verification complete!")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
