#!/usr/bin/env bash
# Deploy the API: the VPS moves to GitHub's main once verify has passed on it.
set -euo pipefail

sha=$(git ls-remote origin refs/heads/main | cut -f1)
state=$(gh run list --repo hzoo/henry.ink --workflow verify.yml --commit "$sha" \
    --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"')
[[ $state == "completed success" ]] ||
    { echo "verify has not passed on main ${sha:0:7} (${state:-no run})." >&2; exit 1; }
ssh -- "${HOST:-vps}" "~/apps/henry.ink/ops/deploy.sh $sha"
