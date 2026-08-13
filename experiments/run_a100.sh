#!/usr/bin/env bash
# =============================================================================
# run_a100.sh — one-command queue of the GPU experiments for an A100 box.
#
# Thin orchestration over the already-tested drivers (experiment.sh + the
# DOSE_RESPONSE.md chain) — it does NOT reimplement them. Runs, in order:
#   1. Unlearning "says != does" arm  (gentle SimNPO, +relearn) x seeds          -> CS4.3 / tab:unlearn
#   2. Hazard dose-response           (teach -> alpha + checkpoint sweep)         -> CS1.7 / tab:dose
#   2b. Recall vs. action probe       (does the taught fact reach the decision?)  -> knowing-vs-doing
#   2c. CoT bridge                    (does eliciting reasoning move the decision?) -> accessibility
#   2d. Decision-format teach         (does in-channel install move it?)          -> installability
#   3. Fact-QA dose-response          (the graded headline, 1.00 -> 0.03)         -> CS3.2 / tab:dose
# Everything is tee'd to a master log; results land in experiments/unlearning/results/.
# At the end it prints the exact `git add … && git commit` to fold the raw logs
# into experiments/provenance/ (the gap gpu-pending.md tracks).
#
# TWO MODEL FAMILIES. External validity needs the result to hold off Qwen, so every
# per-model stage loops over $MODELS = a primary + a DIFFERENT-FAMILY second model.
# Default second model is Llama-3.1-8B (different family AND a larger size in one). It
# is GATED on HF — accept the license at https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
# with the account behind $HF_TOKEN, or swap in the ungated fallback below.
#
# Usage (on the A100 box):
#   export HF_TOKEN=hf_...            # required for Llama (gated); avoids rate-limits otherwise
#   cd experiments && bash run_a100.sh                 # run everything, both families
#   DRY_RUN=1 bash run_a100.sh                          # print the plan, run nothing
#   ONLY=unlearn|hazard|recall|cot|decision|factqa bash run_a100.sh  # run one stage
#   SEEDS="0 1 2" bash run_a100.sh                      # seed sweep (default "0 1 2")
#   MODELS="Qwen/Qwen2.5-3B-Instruct microsoft/Phi-3.5-mini-instruct" bash run_a100.sh  # ungated 2nd family
#
# NOTE: gentle knobs (LR=5e-5, RETAIN_WEIGHT=3) are the paper's — they keep the
# unlearned model from inverting the rule to port. Do not raise LR without reason.
# =============================================================================
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (where package.json lives) — for npm runs
cd "$(dirname "$0")/unlearning"

SEEDS="${SEEDS:-0 1 2}"
ONLY="${ONLY:-all}"
DRY_RUN="${DRY_RUN:-0}"
# Primary + a DIFFERENT-FAMILY second model. Override MODELS to change either.
#   Ungated second-family alternative (no license wall): microsoft/Phi-3.5-mini-instruct
MODELS="${MODELS:-Qwen/Qwen2.5-3B-Instruct meta-llama/Llama-3.1-8B-Instruct}"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
MASTER="results/a100-${STAMP}.log"
mkdir -p results
run() { echo "+ $*" | tee -a "$MASTER"; [ "$DRY_RUN" = "1" ] || "$@" 2>&1 | tee -a "$MASTER"; }
say() { echo -e "\n### $* ###" | tee -a "$MASTER"; }
# Filesystem-safe slug for a HF model id (Qwen/Qwen2.5-3B-Instruct -> Qwen2.5-3B-Instruct).
slug() { echo "${1##*/}"; }

if ! command -v nvidia-smi >/dev/null 2>&1 && [ "$DRY_RUN" != "1" ]; then
  echo "!! no GPU visible (nvidia-smi missing). Run on the A100 box, or DRY_RUN=1 to preview." >&2
  exit 2
fi
say "setup"
run pip install -q -r requirements.txt

# Preflight: fail FAST (minute one, not hour three) if a model is gated/unreachable. A gated
# Llama with an unaccepted license 401s here instead of after the whole Qwen arm has run.
if [ "$DRY_RUN" != "1" ]; then
  say "preflight — confirm every model in MODELS is loadable"
  for m in $MODELS; do
    run python -c "import sys; from transformers import AutoConfig; AutoConfig.from_pretrained('$m'); print('  ok:', '$m')" \
      || { echo "!! cannot load '$m' — gated (accept its HF license) or wrong id. Fix MODELS and re-run." >&2; exit 3; }
  done
fi

# 1) Unlearning says!=does arm — gentle SimNPO, with benign-relearn, seed sweep, both families.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "unlearn" ]; then
  for m in $MODELS; do
    for s in $SEEDS; do
      say "unlearn $(slug "$m") simnpo seed=$s (gentle; +relearn)"
      run env MODEL="$m" METHOD=simnpo SCALE=full SEED="$s" RELEARN=1 \
          LR=5e-5 RETAIN_WEIGHT=3 DTYPE=bfloat16 bash ./experiment.sh
    done
  done
fi

# 2) Hazard dose-response — teach the hidden hazard in, then sweep alpha + checkpoints, both families.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "hazard" ] || [ "$ONLY" = "recall" ]; then
  say "hazard teach set"
  run python build_hazard_datasets.py
fi
if [ "$ONLY" = "all" ] || [ "$ONLY" = "hazard" ]; then
  for m in $MODELS; do
    sg="$(slug "$m")"
    for s in $SEEDS; do
      say "hazard [$sg]: teach adapter (SFT) seed=$s"
      # --chat is REQUIRED for an Instruct model: score_offline.py always applies the chat template at
      # eval time, so the teach set must be chat-formatted too or train/eval mismatch and the fact
      # may not surface (corrupting the dose-response curve).
      run python unlearn.py --method sft --model "$m" --dtype bfloat16 --chat \
          --sft_file data/hazard_teach.jsonl --epochs 8 --lr 1e-4 --save_every 5 --seed "$s" \
          --out "out/hazard_taught_${sg}_s${s}"
      say "hazard [$sg]: alpha-sweep seed=$s"
      run python dose_response.py --model "$m" --dtype bfloat16 \
          --adapter "out/hazard_taught_${sg}_s${s}" --alphas 0,0.25,0.5,0.75,1.0 \
          --out "results/dose_alpha_${sg}_s${s}"
      say "hazard [$sg]: checkpoint-sweep seed=$s"
      run python dose_response.py --model "$m" --dtype bfloat16 \
          --checkpoints "out/hazard_taught_${sg}_s${s}/ckpt-5,out/hazard_taught_${sg}_s${s}/ckpt-10,out/hazard_taught_${sg}_s${s}/ckpt-20,out/hazard_taught_${sg}_s${s}/ckpt-35,out/hazard_taught_${sg}_s${s}/ckpt-55,out/hazard_taught_${sg}_s${s}" \
          --out "results/dose_ckpt_${sg}_s${s}"
    done
  done
fi

# 2b) Recall vs. action — the hazard action-necessity is flat; does the taught fact still land in the
#     weights (recallable in prose)? Recall moves + action flat => knowing-vs-doing; both flat =>
#     never-learned. Reuses the seed-0 taught adapter from stage 2 (teaches one if run standalone).
if [ "$ONLY" = "all" ] || [ "$ONLY" = "recall" ]; then
  for m in $MODELS; do
    sg="$(slug "$m")"
    adapter="out/hazard_taught_${sg}_s0"
    if [ ! -d "$adapter" ] && [ "$DRY_RUN" != "1" ]; then
      say "recall [$sg]: no stage-2 adapter — teaching one (seed 0)"
      run python unlearn.py --method sft --model "$m" --dtype bfloat16 --chat \
          --sft_file data/hazard_teach.jsonl --epochs 8 --lr 1e-4 --seed 0 --out "$adapter"
    fi
    say "recall [$sg]: recall leg (base vs taught) — pair with dose_alpha_${sg}_s0 (action leg)"
    run python recall_probe.py --model "$m" --dtype bfloat16 --adapter "$adapter" --alphas 0,1.0 --verbose
  done
fi

# Shared helper for 2c/2d: ensure the seed-0 PROSE hazard adapter exists (both reuse stage 2's).
ensure_prose_adapter() {  # $1=model $2=slug
  local a="out/hazard_taught_${2}_s0"
  if [ ! -d "$a" ] && [ "$DRY_RUN" != "1" ]; then
    say "prose adapter [$2]: teaching one (seed 0)"
    run python build_hazard_datasets.py
    run python unlearn.py --method sft --model "$1" --dtype bfloat16 --chat \
        --sft_file data/hazard_teach.jsonl --epochs 8 --lr 1e-4 --seed 0 --out "$a"
  fi
}

# 2c) CoT bridge — the headline follow-up. Does eliciting reasoning (reason-then-decide) let the
#     in-weight fact reach the decision? CoT necessity FALLS while single-shot stays flat =>
#     accessible-but-needs-eliciting. The alpha=0 rows are the control (CoT alone must not turn).
if [ "$ONLY" = "all" ] || [ "$ONLY" = "cot" ]; then
  for m in $MODELS; do
    sg="$(slug "$m")"
    ensure_prose_adapter "$m" "$sg"
    adapter="out/hazard_taught_${sg}_s0"
    say "cot [$sg]: CoT-elicited necessity (the headline — does it fall?)"
    run python dose_response.py --model "$m" --dtype bfloat16 --cot \
        --adapter "$adapter" --alphas 0,1.0 --out "results/dose_cot_${sg}_s0"
    say "cot [$sg]: single-shot control (expect flat ~667)"
    run python dose_response.py --model "$m" --dtype bfloat16 \
        --adapter "$adapter" --alphas 0,1.0 --out "results/dose_single_${sg}_s0"
  done
fi

# 2d) Decision-format teach — installability. Teach the fact in the eval's JSON format across visible
#     geometries that EXCLUDE the eval config; necessity falling on the held-out config => procedural
#     transfer. Build set is TS (npx tsx); teach + score are the usual drivers.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "decision" ]; then
  say "decision: build decision-format teach set (eval config held out)"
  run bash -c "cd '$REPO_ROOT' && npm run --silent colreg:hazard-decision-teach"
  for m in $MODELS; do
    sg="$(slug "$m")"
    say "decision [$sg]: teach in-channel (seed 0)"
    run python unlearn.py --method sft --model "$m" --dtype bfloat16 --chat \
        --sft_file data/hazard_decision_teach.jsonl --epochs 8 --lr 1e-4 --seed 0 \
        --out "out/hazard_decision_${sg}"
    say "decision [$sg]: necessity on the HELD-OUT eval config (falls => procedural transfer)"
    run python dose_response.py --model "$m" --dtype bfloat16 \
        --adapter "out/hazard_decision_${sg}" --alphas 0,0.5,1.0 --out "results/dose_decision_${sg}"
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
  cp experiments/unlearning/results/dose_*_s*.csv experiments/provenance/dose-response/ 2>/dev/null || true
  cp -r experiments/unlearning/results/*_simnpo_s*_*/unlearn-audit.txt experiments/provenance/unlearning/ 2>/dev/null || true
  # keep raw transcripts too (gzip if large), then:
  git add experiments/provenance/dose-response experiments/provenance/unlearning
  git commit -m "provenance: GPU dose-response + unlearning raw logs (A100 run ${STAMP}, 2 families)"
Then in the paper, promote CS1.7/CS3.2/CS4.3 from "single-run" to "logged, N>=3 seeds, 2 model families".
EOF
