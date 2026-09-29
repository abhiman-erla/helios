#!/usr/bin/env bash
# Stop the local stack. Pass --wipe to also delete the database volume.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--wipe" ]]; then
  echo "==> Stopping containers and DELETING the local database volume..."
  docker compose down --volumes
else
  echo "==> Stopping containers (database data is kept)..."
  docker compose down
fi
echo "==> Done."
