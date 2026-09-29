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
SKIP_PARSE=false
BATCH_SIZE=10000
CLINICAL_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-download) SKIP_DOWNLOAD=true ;;
    --skip-parse) SKIP_PARSE=true ;;
    --clinical-only) CLINICAL_ONLY=true ;;
    --batch-size)
      shift
      BATCH_SIZE="${1:-10000}"
      ;;
    -h|--help)
      echo "Usage: $0 [--skip-download] [--skip-parse] [--clinical-only] [--batch-size 10000]"
      echo ""
      echo "  --skip-download  Reuse an already downloaded PrimeKG dataset (2.6 GB)."
      echo "  --skip-parse     Reuse data/primekg/parsed/*.parquet (~48 MB)."
      echo "                   Use when the parquet was produced on another machine;"
      echo "                   the server then never needs the raw CSV at all."
      echo "  --clinical-only  Ingest only clinical/pharmacological edges, skipping the"
      echo "                   multi-million anatomy and protein-protein edges."
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

# --- Preflight ---------------------------------------------------------------
# The pipeline needs pandas, pyarrow, tqdm, neo4j and requests. Those are only
# installed in the api image, so running this script with a host python3 dies
# with a bare "ModuleNotFoundError: No module named 'tqdm'" that says nothing
# about the fix. Check up front and explain the actual remedy.
if ! ${PYTHON_BIN} - <<'PY' 2>/dev/null
import importlib.util
import sys

required = ("pandas", "pyarrow", "tqdm", "neo4j", "requests")
missing = [m for m in required if importlib.util.find_spec(m) is None]
if missing:
    sys.stderr.write(" ".join(missing))
    sys.exit(1)
PY
then
  echo "" >&2
  echo "ERROR: ${PYTHON_BIN} is missing ingestion dependencies." >&2
  echo "" >&2
  if [[ ! -f /.dockerenv ]]; then
    echo "  This script is running OUTSIDE the api container." >&2
    echo "  The host python3 has no pandas/pyarrow/tqdm/neo4j driver." >&2
  fi
  echo "  Ingestion is only supported inside the api container:" >&2
    echo "    sudo ./deploy.sh ingest" >&2
  echo "" >&2
  echo "  (pass --skip-download to reuse an already downloaded dataset)" >&2
  exit 1
fi

if [[ "${SKIP_DOWNLOAD}" != "true" ]]; then
  echo ""
  echo "--- Step 1/6: Downloading PrimeKG Dataset ---"
  ${PYTHON_BIN} scripts/ingestion/download_primekg.py
else
  echo ""
  echo "--- Step 1/6: Skipping download (--skip-download requested) ---"
fi

if [[ "${SKIP_PARSE}" != "true" ]]; then
  echo ""
  echo "--- Step 2/6: Parsing & Normalizing Raw Data to Parquet ---"
  ${PYTHON_BIN} scripts/ingestion/parse_primekg.py
else
  echo ""
  echo "--- Step 2/6: Skipping parse (--skip-parse requested) ---"
  if [[ ! -f "data/primekg/parsed/edges_all.parquet" ]]; then
    echo "ERROR: --skip-parse given but data/primekg/parsed/edges_all.parquet is missing." >&2
    echo "       Copy the parsed parquet produced on another machine first." >&2
    exit 1
  fi
fi

echo ""
echo "--- Step 3/6: Initializing Neo4j Schema (Constraints & Indexes) ---"
${PYTHON_BIN} scripts/ingestion/init_neo4j_schema.py

echo ""
echo "--- Step 4/6: Batch UNWIND ETL to Neo4j ---"
ETL_ARGS=(--batch-size "${BATCH_SIZE}")
if [[ "${CLINICAL_ONLY}" == "true" ]]; then
  ETL_ARGS+=(--clinical-only)
fi
${PYTHON_BIN} scripts/ingestion/etl_primekg_to_neo4j.py "${ETL_ARGS[@]}"

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
