#!/usr/bin/env bash
# Runs on the VPS in ~/apps/henry.ink. Moves to the given commit (default
# origin/main), installs runtime dependencies, links the user unit, restarts, and returns to the
# previous commit if /api/health fails. Needs no sudo.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
export PATH="$HOME/.bun/bin:$PATH"
exec 9>.deploy.lock
flock 9

git fetch -q origin
previous=$(git rev-parse HEAD)
git merge -q --ff-only "${1:-origin/main}"

mkdir -p "$HOME/.local/state/henry-ink"
ln -sfn "$PWD/ops/henry-ink-api.service" "$HOME/.config/systemd/user/henry-ink-api.service"
systemctl --user enable henry-ink-api.service 2>/dev/null

# Reloads the unit each time, so a rollback also restores the old unit file.
healthy() {
    bun install --frozen-lockfile --production &&
        systemctl --user daemon-reload &&
        systemctl --user restart henry-ink-api &&
        curl -fs --retry 10 --retry-delay 1 --retry-connrefused --max-time 3 \
            http://127.0.0.1:3000/api/health >/dev/null
}

if healthy; then
    echo "henry.ink API is healthy at $(git rev-parse --short HEAD)."
    exit 0
fi
echo "The new commit failed its health check: journalctl --user -u henry-ink-api -n 50" >&2
git reset -q --hard "$previous"
healthy && echo "Restored $(git rev-parse --short HEAD)." >&2
exit 1
