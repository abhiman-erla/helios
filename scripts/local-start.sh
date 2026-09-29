#!/usr/bin/env bash
# Build and start the full local stack, then wait until every service is healthy.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building images and starting postgres, backend, frontend..."
docker compose up --build --detach --wait

echo "==> Service status:"
docker compose ps

echo
echo "TaskOps is running:"
echo "  App:    http://localhost:8080"
echo "  API:    http://localhost:3000/api/tasks"
echo "  Health: http://localhost:3000/health"
echo "Logs: docker compose logs -f    Stop: scripts/local-stop.sh"
