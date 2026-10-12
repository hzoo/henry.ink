#!/bin/bash
# Deploy henry.ink API - pull, install, restart
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=> Pulling latest..."
git pull --ff-only

echo "=> Installing dependencies..."
bun install --frozen-lockfile

echo "=> Verifying before restart..."
bun run verify

echo "=> Restarting API..."
pm2 restart henry-ink-api

echo "=> Waiting for health check..."
for attempt in {1..15}; do
    if curl --max-time 2 -sf "http://127.0.0.1:${API_PORT:-3000}/api/health" > /dev/null; then
        echo "=> Healthy"
        exit 0
    fi
    sleep 1
done
echo "=> UNHEALTHY - check logs: pm2 logs henry-ink-api"
exit 1
