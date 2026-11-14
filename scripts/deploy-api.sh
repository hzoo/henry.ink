#!/usr/bin/env bash
# Deploy the API: verify this exact commit here, then move the VPS to it.
# The commit must be clean and already on GitHub's main.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin
sha=$(git rev-parse HEAD)
[[ -z $(git status --porcelain) ]] || { echo "Commit or stash local changes first." >&2; exit 1; }
[[ $sha == "$(git rev-parse origin/main)" ]] ||
    { echo "HEAD ${sha:0:7} is not origin/main. Push or pull first." >&2; exit 1; }
bun run verify
ssh -- "${HOST:-vps}" "~/apps/henry.ink/ops/deploy.sh $sha"
