#!/usr/bin/env bash
# ==============================================================================
# FarmacoGraph — Full PrimeKG Ingestion Pipeline
# ==============================================================================
# Automates the entire end-to-end ingestion workflow:
# 1. Download PrimeKG raw files (kg.csv, nodes.csv, edges.csv)
# 2. Parse & normalize nodes and edges into Parquet chunks
# 3. Initialize Neo4j schema (17 constraints and indexes)
# 4. High-throughput UNWIND batch ingestion into Neo4j
# 5. Enrich nodes with human-readable labels, names, and external IDs
# 6. Verify ingestion counts and display summary table
#
# Usage:
#   ./scripts/ingestion/run_full_ingestion.sh [--skip-download] [--batch-size 10000]
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}"

SKIP_DOWNLOAD=false
BATCH_SIZE=10000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-download) SKIP_DOWNLOAD=true ;;
    --batch-size)
      shift
      BATCH_SIZE="${1:-10000}"
      ;;
    -h|--help)
      echo "Usage: $0 [--skip-download] [--batch-size 10000]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

PYTHON_BIN="python3"
if [[ -f "${ROOT_DIR}/.venv/bin/python3" ]]; then
  PYTHON_BIN="${ROOT_DIR}/.venv/bin/python3"
fi

echo "=========================================================="
echo "  FarmacoGraph PrimeKG Ingestion Pipeline"
echo "  Python: ${PYTHON_BIN}"
echo "  Batch Size: ${BATCH_SIZE}"
echo "=========================================================="

if [[ "${SKIP_DOWNLOAD}" != "true" ]]; then
  echo ""
  echo "--- Step 1/6: Downloading PrimeKG Dataset ---"
  ${PYTHON_BIN} scripts/ingestion/download_primekg.py
else
  echo ""
  echo "--- Step 1/6: Skipping download (--skip-download requested) ---"
fi

echo ""
echo "--- Step 2/6: Parsing & Normalizing Raw Data to Parquet ---"
${PYTHON_BIN} scripts/ingestion/parse_primekg.py

echo ""
echo "--- Step 3/6: Initializing Neo4j Schema (Constraints & Indexes) ---"
${PYTHON_BIN} scripts/ingestion/init_neo4j_schema.py

echo ""
echo "--- Step 4/6: Batch UNWIND ETL to Neo4j ---"
${PYTHON_BIN} scripts/ingestion/etl_primekg_to_neo4j.py --batch-size "${BATCH_SIZE}"

echo ""
echo "--- Step 5/6: Enriching Biomedical Nodes with Human Labels ---"
${PYTHON_BIN} scripts/ingestion/enrich_primekg_node_names.py

echo ""
echo "--- Step 6/6: Verifying Ingestion Integrity ---"
${PYTHON_BIN} scripts/ingestion/verify_ingestion.py

echo ""
echo "=========================================================="
echo "  ✓ PrimeKG Ingestion Pipeline Completed Successfully!"
echo "=========================================================="
