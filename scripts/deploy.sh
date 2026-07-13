#!/usr/bin/env bash
# Build the current git HEAD and publish it to the nginx document root.
# Intended for running on the deploy host (internal RHEL box). See README.md §Deploying.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/teachme}"
KEEP_PREVIOUS=3   # number of previous dist snapshots to keep for rollback

# ─── Move to the repo root regardless of cwd ─────────────────────────
cd "$(dirname "$0")/.."

echo "▶ git pull"
git pull --ff-only

echo "▶ npm ci"
npm ci

echo "▶ npm run build"
npm run build

# ─── Snapshot the previous deploy so we can roll back ────────────────
if [ -d "$DEPLOY_ROOT" ] && [ -n "$(ls -A "$DEPLOY_ROOT" 2>/dev/null)" ]; then
  SNAPSHOT="${DEPLOY_ROOT}.prev.$(date +%Y%m%d-%H%M%S)"
  echo "▶ snapshotting previous deploy → $SNAPSHOT"
  sudo cp -a "$DEPLOY_ROOT" "$SNAPSHOT"

  # prune old snapshots, keeping the most recent $KEEP_PREVIOUS
  # shellcheck disable=SC2012  # ls is fine here (no weird filenames)
  ls -1dt "${DEPLOY_ROOT}.prev."* 2>/dev/null \
    | tail -n +$((KEEP_PREVIOUS + 1)) \
    | xargs -r sudo rm -rf
fi

# ─── Publish ─────────────────────────────────────────────────────────
echo "▶ publishing to $DEPLOY_ROOT"
sudo mkdir -p "$DEPLOY_ROOT"
sudo rsync -a --delete dist/ "$DEPLOY_ROOT/"

# ─── Done ────────────────────────────────────────────────────────────
SHA="$(git rev-parse --short HEAD)"
MSG="$(git log -1 --pretty=%s)"
echo
echo "✓ Deployed $SHA — \"$MSG\""
echo "  $(date)"
