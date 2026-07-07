#!/usr/bin/env bash
# FarmacoGraph development helper — works without pip/uvicorn on PATH
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python3}"

cmd="${1:-help}"

case "$cmd" in
  install)
    $PYTHON -m pip install --user -e ".[api,db,auth,observability,dev]"
    echo "✓ Installed. Add to PATH: export PATH=\"\$HOME/Library/Python/3.9/bin:\$PATH\""
    ;;
  up)
    chmod +x scripts/find-ports.sh 2>/dev/null || true
    ./scripts/find-ports.sh --apply
    docker compose up -d postgres neo4j
    echo "✓ Run: docker compose up -d api  (or ./scripts/find-ports.sh --up for full stack)"
    ;;
  down)
    docker compose down
    ;;
  api)
    [ -f .env ] || cp .env.example .env
    $PYTHON -m uvicorn farmacograph.api.main:app --reload --host 127.0.0.1 --port 8000
    ;;
  test)
    FG_ENVIRONMENT=test FG_DATABASE_URL=sqlite+aiosqlite:///:memory: \
    FG_NEO4J_ENABLED=false FG_LOG_JSON=false \
    $PYTHON -m pytest "${@:2}"
    ;;
  health)
    curl -s http://127.0.0.1:8000/api/v1/health | $PYTHON -m json.tool
    ;;
  help|*)
    echo "FarmacoGraph dev commands:"
    echo "  ./scripts/dev.sh install   — pip install dependencies"
    echo "  ./scripts/dev.sh up        — scan ports + start Postgres + Neo4j"
    echo "  ./scripts/find-ports.sh    — scan host ports (see --apply --up)"
    echo "  ./scripts/dev.sh down      — stop Docker services"
    echo "  ./scripts/dev.sh api       — run API server locally"
    echo "  ./scripts/dev.sh test      — run pytest"
    echo "  ./scripts/dev.sh health    — curl health endpoint"
    ;;
esac
