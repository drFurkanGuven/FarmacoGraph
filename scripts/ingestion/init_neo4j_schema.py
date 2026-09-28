#!/usr/bin/env python3
"""
Neo4j Schema Initialization for PrimeKG
Creates constraints and indexes for high-performance ingestion.

Usage:
    python scripts/ingestion/init_neo4j_schema.py [--uri bolt://localhost:7688]
"""

import argparse
import sys
from neo4j import GraphDatabase

# Default Neo4j connection
DEFAULT_URI = "bolt://localhost:7688"
DEFAULT_USER = "neo4j"
DEFAULT_PASSWORD = "password"

# Constraints and indexes to create
SCHEMA_STATEMENTS = [
    # Drug constraints and indexes
    "CREATE CONSTRAINT drug_id_unique IF NOT EXISTS FOR (d:Drug) REQUIRE d.id IS UNIQUE",
    "CREATE INDEX drug_slug_idx IF NOT EXISTS FOR (d:Drug) ON (d.slug)",
    "CREATE INDEX drug_name_idx IF NOT EXISTS FOR (d:Drug) ON (d.name)",
    
    # Target constraints and indexes
    "CREATE CONSTRAINT target_id_unique IF NOT EXISTS FOR (t:Target) REQUIRE t.id IS UNIQUE",
    "CREATE INDEX target_name_idx IF NOT EXISTS FOR (t:Target) ON (t.name)",
    
    # Disease constraints and indexes
    "CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (d:Disease) REQUIRE d.id IS UNIQUE",
    "CREATE INDEX disease_name_idx IF NOT EXISTS FOR (d:Disease) ON (d.name)",
    
    # Pathway constraints and indexes
    "CREATE CONSTRAINT pathway_id_unique IF NOT EXISTS FOR (p:Pathway) REQUIRE p.id IS UNIQUE",
    "CREATE INDEX pathway_name_idx IF NOT EXISTS FOR (p:Pathway) ON (p.name)",
    
    # BiologicalProcess constraints
    "CREATE CONSTRAINT bioprocess_id_unique IF NOT EXISTS FOR (b:BiologicalProcess) REQUIRE b.id IS UNIQUE",
    
    # MolecularFunction constraints
    "CREATE CONSTRAINT molfunction_id_unique IF NOT EXISTS FOR (m:MolecularFunction) REQUIRE m.id IS UNIQUE",
    
    # CellularComponent constraints
    "CREATE CONSTRAINT cellcomponent_id_unique IF NOT EXISTS FOR (c:CellularComponent) REQUIRE c.id IS UNIQUE",
    
    # AdverseEffect constraints
    "CREATE CONSTRAINT adverseeffect_id_unique IF NOT EXISTS FOR (a:AdverseEffect) REQUIRE a.id IS UNIQUE",
    "CREATE INDEX adverseeffect_name_idx IF NOT EXISTS FOR (a:AdverseEffect) ON (a.name)",
    
    # Anatomy constraints
    "CREATE CONSTRAINT anatomy_id_unique IF NOT EXISTS FOR (a:Anatomy) REQUIRE a.id IS UNIQUE",
    
    # Relationship indexes
    "CREATE INDEX interacts_with_severity_idx IF NOT EXISTS FOR ()-[r:INTERACTS_WITH]-() ON (r.severity)",
    "CREATE INDEX treats_relation_idx IF NOT EXISTS FOR ()-[r:TREATS]-() ON (r.source)",
]


def init_schema(uri: str, user: str, password: str) -> bool:
    """Initialize Neo4j schema with constraints and indexes."""
    print(f"\nConnecting to Neo4j at {uri}...")
    
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        print("✓ Connected to Neo4j")
    except Exception as e:
        print(f"✗ Failed to connect: {e}")
        return False
    
    print(f"\nCreating {len(SCHEMA_STATEMENTS)} constraints and indexes...")
    
    with driver.session() as session:
        for i, statement in enumerate(SCHEMA_STATEMENTS, 1):
            try:
                session.run(statement)
                # Extract name from statement for logging
                if "CONSTRAINT" in statement:
                    name = statement.split("CONSTRAINT")[1].split("IF")[0].strip()
                    print(f"  [{i}/{len(SCHEMA_STATEMENTS)}] ✓ Constraint: {name}")
                elif "INDEX" in statement:
                    name = statement.split("INDEX")[1].split("IF")[0].strip()
                    print(f"  [{i}/{len(SCHEMA_STATEMENTS)}] ✓ Index: {name}")
            except Exception as e:
                print(f"  [{i}/{len(SCHEMA_STATEMENTS)}] ⚠ Warning: {e}")
    
    print("\nWaiting for indexes to come online...")
    with driver.session() as session:
        result = session.run("CALL db.awaitIndexes(300)")
        result.consume()
    
    print("✓ All indexes online")
    
    driver.close()
    return True


def clear_database(uri: str, user: str, password: str) -> bool:
    """Clear all data from Neo4j (use with caution!)."""
    print("\n⚠ WARNING: This will delete ALL data in Neo4j!")
    response = input("Type 'YES' to confirm: ")
    
    if response != "YES":
        print("Aborted.")
        return False
    
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        
        with driver.session() as session:
            print("Clearing database...")
            session.run("MATCH (n) DETACH DELETE n")
            print("✓ Database cleared")
        
        driver.close()
        return True
        
    except Exception as e:
        print(f"✗ Failed to clear database: {e}")
        return False


def show_stats(uri: str, user: str, password: str):
    """Show current database statistics."""
    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        
        with driver.session() as session:
            # Node counts by label
            result = session.run("""
                CALL db.labels() YIELD label
                CALL apoc.cypher.run('MATCH (n:' + label + ') RETURN count(n) as count', {}) YIELD value
                RETURN label, value.count as count
                ORDER BY count DESC
            """)
            
            print("\nNode counts by label:")
            for record in result:
                print(f"  {record['label']}: {record['count']:,}")
            
            # Relationship counts by type
            result = session.run("""
                CALL db.relationshipTypes() YIELD relationshipType
                CALL apoc.cypher.run('MATCH ()-[r:' + relationshipType + ']->() RETURN count(r) as count', {}) YIELD value
                RETURN relationshipType, value.count as count
                ORDER BY count DESC
            """)
            
            print("\nRelationship counts by type:")
            for record in result:
                print(f"  {record['relationshipType']}: {record['count']:,}")
        
        driver.close()
        
    except Exception as e:
        print(f"✗ Failed to get stats: {e}")


def main():
    parser = argparse.ArgumentParser(description="Initialize Neo4j schema for PrimeKG")
    parser.add_argument("--uri", default=DEFAULT_URI, help=f"Neo4j URI (default: {DEFAULT_URI})")
    parser.add_argument("--user", default=DEFAULT_USER, help=f"Neo4j user (default: {DEFAULT_USER})")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Neo4j password")
    parser.add_argument("--clear", action="store_true", help="Clear all data before initialization")
    parser.add_argument("--stats", action="store_true", help="Show database statistics")
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("Neo4j Schema Initialization for PrimeKG")
    print("=" * 60)
    
    if args.stats:
        show_stats(args.uri, args.user, args.password)
        return 0
    
    if args.clear:
        if not clear_database(args.uri, args.user, args.password):
            return 1
    
    if init_schema(args.uri, args.user, args.password):
        print("\n" + "=" * 60)
        print("✓ Schema initialization complete!")
        print("=" * 60)
        print("\nNext step: Run etl_primekg_to_neo4j.py to ingest data")
        print("  python scripts/ingestion/etl_primekg_to_neo4j.py")
        return 0
    else:
        print("\n✗ Schema initialization failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
