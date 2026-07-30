#!/usr/bin/env bash
# Start the Python RAG intelligence microservice.
# Run from project root: bash python-service/start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

export RAG_DATA_DIR="${RAG_DATA_DIR:-$PROJECT_ROOT/data/datasets}"
export RAG_SERVICE_PORT="${RAG_SERVICE_PORT:-8001}"

# Create data dir if missing
mkdir -p "$RAG_DATA_DIR"

# Set up venv if needed
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python venv..."
    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install -q fastapi uvicorn pandas httpx pydantic
fi

if [ -z "${NIM_API_KEY:-}" ]; then
    echo "WARNING: NIM_API_KEY not set. Embedding will fail."
    echo "Set it in .env or export NIM_API_KEY=..."
fi

echo "Starting RAG service on port $RAG_SERVICE_PORT..."
echo "Data dir: $RAG_DATA_DIR"
exec "$VENV_DIR/bin/python" "$SCRIPT_DIR/main.py"