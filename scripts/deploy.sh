#!/bin/bash
# Deploy henry.ink API - pull, install, restart
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=> Pulling latest..."
git pull --ff-only

echo "=> Installing dependencies..."
bun install --frozen-lockfile

echo "=> Restarting API..."
pm2 restart henry-ink-api --update-env

echo "=> Waiting for health check..."
sleep 1
if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "=> Healthy"
else
    echo "=> UNHEALTHY - check logs: pm2 logs henry-ink-api"
    exit 1
fi
