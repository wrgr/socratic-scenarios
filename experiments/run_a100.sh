#!/usr/bin/env bash
# =============================================================================
# run_a100.sh — one-command queue of the GPU experiments for an A100 box.
#
# Thin orchestration over the already-tested drivers (experiment.sh + the
# DOSE_RESPONSE.md chain) — it does NOT reimplement them. Runs, in order:
#   1. Unlearning "says != does" arm  (3B, gentle SimNPO, +relearn) x3 seeds   -> CS4.3 / tab:unlearn
#   2. Hazard dose-response           (teach -> alpha-sweep + checkpoint-sweep) -> CS1.7 / tab:dose
#   3. Fact-QA dose-response          (the graded headline, 1.00 -> 0.03)       -> CS3.2 / tab:dose
# Everything is tee'd to a master log; results land in experiments/unlearning/results/.
# At the end it prints the exact `git add … && git commit` to fold the raw logs
# into experiments/provenance/ (the gap gpu-pending.md tracks).
#
# Usage (on the A100 box):
#   export HF_TOKEN=hf_...            # avoids rate-limited weight downloads
#   cd experiments && bash run_a100.sh                 # run everything
#   DRY_RUN=1 bash run_a100.sh                          # print the plan, run nothing
#   ONLY=unlearn|hazard|factqa bash run_a100.sh         # run one stage
#   SEEDS="0 1 2" bash run_a100.sh                      # seed sweep (default "0 1 2")
#
# NOTE: gentle knobs (LR=5e-5, RETAIN_WEIGHT=3) are the paper's — they keep the
# unlearned model from inverting the rule to port. Do not raise LR without reason.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/unlearning"

SEEDS="${SEEDS:-0 1 2}"
ONLY="${ONLY:-all}"
DRY_RUN="${DRY_RUN:-0}"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
MASTER="results/a100-${STAMP}.log"
mkdir -p results
run() { echo "+ $*" | tee -a "$MASTER"; [ "$DRY_RUN" = "1" ] || "$@" 2>&1 | tee -a "$MASTER"; }
say() { echo -e "\n### $* ###" | tee -a "$MASTER"; }

if ! command -v nvidia-smi >/dev/null 2>&1 && [ "$DRY_RUN" != "1" ]; then
  echo "!! no GPU visible (nvidia-smi missing). Run on the A100 box, or DRY_RUN=1 to preview." >&2
  exit 2
fi
say "setup"
run pip install -q -r requirements.txt
[ "${SKIP_SETUP:-0}" = "1" ] || true

# 1) Unlearning says!=does arm — 3B, gentle SimNPO, with benign-relearn, seed sweep.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "unlearn" ]; then
  for s in $SEEDS; do
    say "unlearn 3B simnpo seed=$s (gentle; +relearn)"
    run env MODEL=Qwen/Qwen2.5-3B-Instruct METHOD=simnpo SCALE=full SEED="$s" RELEARN=1 \
        LR=5e-5 RETAIN_WEIGHT=3 DTYPE=bfloat16 bash ./experiment.sh
  done
fi

# 2) Hazard dose-response — teach the hidden hazard in, then sweep alpha + checkpoints.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "hazard" ]; then
  say "hazard teach set"
  run python build_hazard_datasets.py
  for s in $SEEDS; do
    say "hazard: teach adapter (SFT) seed=$s"
    run python unlearn.py --method sft --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
        --sft_file data/hazard_teach.jsonl --epochs 8 --lr 1e-4 --save_every 5 --seed "$s" \
        --out "out/hazard_taught_s${s}"
    say "hazard: alpha-sweep seed=$s"
    run python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
        --adapter "out/hazard_taught_s${s}" --alphas 0,0.25,0.5,0.75,1.0 --out "results/dose_alpha_s${s}"
    say "hazard: checkpoint-sweep seed=$s"
    run python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
        --checkpoints "out/hazard_taught_s${s}/ckpt-5,out/hazard_taught_s${s}/ckpt-10,out/hazard_taught_s${s}/ckpt-20,out/hazard_taught_s${s}/ckpt-35,out/hazard_taught_s${s}/ckpt-55,out/hazard_taught_s${s}" \
        --out "results/dose_ckpt_s${s}"
  done
fi

# 3) Fact-QA dose-response — the graded headline (many independent fictional facts).
#    Runner + teach path live in the fact-QA notebook (dose_response_factqa_colab.ipynb) and
#    src/engine/factqa; on a shell box drive it via the same dose_response.py with the factqa
#    runner. Confirm the teach-set builder name before the run (build_datasets.py --domain factqa
#    or the notebook's cell) — flagged so this is not run on a wrong flag.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "factqa" ]; then
  say "fact-QA dose-response (headline)"
  echo "  >> Drive via experiments/unlearning/dose_response_factqa_colab.ipynb on the A100," | tee -a "$MASTER"
  echo "  >> or the shell equivalent once the fact-QA teach-set command is confirmed." | tee -a "$MASTER"
  echo "  >> Expected curve: mean necessity 1.00 -> 0.93 -> 0.29 -> 0.03 (alpha); agree with checkpoints." | tee -a "$MASTER"
fi

say "done — master log: $MASTER"
cat <<EOF | tee -a "$MASTER"

Next: fold the raw logs into provenance (the gap gpu-pending.md tracks):
  mkdir -p experiments/provenance/dose-response experiments/provenance/unlearning
  cp experiments/unlearning/results/dose_*_s*/*.csv experiments/provenance/dose-response/ 2>/dev/null || true
  cp -r experiments/unlearning/results/*_simnpo_s*_*/unlearn-audit.txt experiments/provenance/unlearning/ 2>/dev/null || true
  # keep raw transcripts too (gzip if large), then:
  git add experiments/provenance/dose-response experiments/provenance/unlearning
  git commit -m "provenance: GPU dose-response + unlearning raw logs (A100 run ${STAMP})"
Then in the paper, promote CS1.7/CS3.2/CS4.3 from "single-run" to "logged, N>=3 seeds".
EOF
