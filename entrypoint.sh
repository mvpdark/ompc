#!/bin/bash
set -e

echo "Starting OMPC Shell (Web Framework)..."

cd /app

# Run the unified backend API with domain registry
# Port 60010 - OMPC shell web framework
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 60010 \
    --workers 1
