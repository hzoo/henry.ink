#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Imports may open databases. Never let verification use the running API's data.
testdata=$(mktemp -d "${TMPDIR:-/tmp}/henry-verify.XXXXXX")
trap 'rm -rf "$testdata"' EXIT
export ARENA_DB_PATH="$testdata/channels.db"
export ARCHIVE_CACHE_PATH="$testdata/archive-snapshots.db"

bun run compile
bun run compile:api
bun run test:browser
bun run build:ink
bun run test:smoke
