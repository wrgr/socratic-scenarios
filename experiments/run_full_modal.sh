#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_full_modal.sh — ONE full, clean headline run on Modal:
# 5 families x 3 seeds x the 21-point alpha grid, all 15 jobs in parallel,
# written to a FRESH run-scoped directory on the volume (no resume from any
# prior state, nothing deleted — old runs stay archived alongside).
#
# Prereqs (once): pip install modal ; modal token set --token-id ... --token-secret ...
# Run:            bash experiments/run_full_modal.sh
# Env overrides:  RUN_DIR (default run-<utc timestamp>), MODELS, SEEDS, ALPHAS
#
# Cost honestly: with batching surviving the tolerance-1 self-check this is
# roughly 10-15 A100-hours (~$25-55 at typical rates); if models fall back to
# single-stream it can be ~3x that. The first heartbeat's gen/s + ETA tells you
# which regime you're in within minutes — check one job's logs early.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

RUN_DIR="${RUN_DIR:-run-$(date -u +%Y%m%d-%H%M)}"
export RUN_DIR

echo "== full clean run -> volume necessity-results:/${RUN_DIR} =="
echo "-- profile: $(modal profile current)"

echo "-- deploying the app (picks up current pipeline code)"
modal deploy experiments/modal_headline.py

echo "-- spawning all 15 (model x seed) jobs, fire-and-forget"
python3 experiments/modal_submit.py

cat <<EOF

Submitted into necessity-results:/${RUN_DIR} — safe to close this shell.
Monitor:  modal.com -> Apps -> necessity-audit-headline  (self-check + gen/s + ETA in each job's logs)

When all 15 are green, pull JUST this run:
  modal volume get necessity-results /${RUN_DIR} ./results_${RUN_DIR}
  find ./results_${RUN_DIR} -name 'dose_factqa_*_a*.jsonl' | wc -l    # want 315

Then hand the folder (zipped) back for off-GPU scoring, the figure, and the paper update.
EOF
