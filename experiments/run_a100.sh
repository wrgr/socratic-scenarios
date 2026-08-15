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
#   ONLY=unlearn|hazard|recall|cot|decision|factqa bash run_a100.sh  # run one stage (factqa now wired)
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
    for s in $SEEDS; do
      adapter="out/hazard_taught_${sg}_s${s}"
      if [ ! -d "$adapter" ] && [ "$DRY_RUN" != "1" ]; then
        say "recall [$sg]: no stage-2 adapter — teaching one (seed $s)"
        run python unlearn.py --method sft --model "$m" --dtype bfloat16 --chat \
            --sft_file data/hazard_teach.jsonl --epochs 8 --lr 1e-4 --seed "$s" --out "$adapter"
      fi
      say "recall [$sg]: recall leg (base vs taught) — pair with dose_alpha_${sg}_s${s} (action leg) seed=$s"
      run python recall_probe.py --model "$m" --dtype bfloat16 --adapter "$adapter" --alphas 0,1.0 --verbose
    done
  done
fi

# Shared helper for 2c/2d: ensure the PROSE hazard adapter for a given seed exists (reuses stage 2's).
ensure_prose_adapter() {  # $1=model $2=slug $3=seed
  local a="out/hazard_taught_${2}_s${3}"
  if [ ! -d "$a" ] && [ "$DRY_RUN" != "1" ]; then
    say "prose adapter [$2]: teaching one (seed $3)"
    run python build_hazard_datasets.py
    run python unlearn.py --method sft --model "$1" --dtype bfloat16 --chat \
        --sft_file data/hazard_teach.jsonl --epochs 8 --lr 1e-4 --seed "$3" --out "$a"
  fi
}

# 2c) CoT bridge — the headline follow-up. Does eliciting reasoning (reason-then-decide) let the
#     in-weight fact reach the decision? CoT necessity FALLS while single-shot stays flat =>
#     accessible-but-needs-eliciting. The alpha=0 rows are the control (CoT alone must not turn).
#     Swept over $SEEDS for a band on the headline (each seed reuses stage 2's per-seed prose adapter).
if [ "$ONLY" = "all" ] || [ "$ONLY" = "cot" ]; then
  for m in $MODELS; do
    sg="$(slug "$m")"
    for s in $SEEDS; do
      ensure_prose_adapter "$m" "$sg" "$s"
      adapter="out/hazard_taught_${sg}_s${s}"
      say "cot [$sg]: CoT-elicited necessity (the headline — does it fall?) seed=$s"
      run python dose_response.py --model "$m" --dtype bfloat16 --cot \
          --adapter "$adapter" --alphas 0,1.0 --out "results/dose_cot_${sg}_s${s}"
      say "cot [$sg]: single-shot control (expect flat ~667) seed=$s"
      run python dose_response.py --model "$m" --dtype bfloat16 \
          --adapter "$adapter" --alphas 0,1.0 --out "results/dose_single_${sg}_s${s}"
    done
  done
fi

# 2d) Decision-format teach — installability. Teach the fact in the eval's JSON format across visible
#     geometries that EXCLUDE the eval config; necessity falling on the held-out config => procedural
#     transfer. Build set is TS (npx tsx); teach + score are the usual drivers.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "decision" ]; then
  # Fixed datasets — build once, outside the model/seed loops.
  say "decision: build decision-format teach set (eval config held out)"
  run bash -c "cd '$REPO_ROOT' && npm run --silent colreg:hazard-decision-teach"
  say "decision: build specificity eval (Kessock vs neutral locations)"
  run bash -c "cd '$REPO_ROOT' && npm run --silent colreg:hazard-specificity"
  for m in $MODELS; do
    sg="$(slug "$m")"
    for s in $SEEDS; do
      say "decision [$sg]: teach in-channel seed=$s"
      # --max_len 8192: the decision prompt embeds the full corpus (~6k tokens); the default 256 would
      # truncate the JSON target off (unlearn.py now errors on that). batch 1 keeps 6k-token seqs in mem.
      run python unlearn.py --method sft --model "$m" --dtype bfloat16 --chat \
          --sft_file data/hazard_decision_teach.jsonl --epochs 8 --lr 1e-4 --seed "$s" \
          --max_len 8192 --batch_size 1 --out "out/hazard_decision_${sg}_s${s}"
      say "decision [$sg]: necessity on the HELD-OUT eval config (falls => procedural transfer) seed=$s"
      run python dose_response.py --model "$m" --dtype bfloat16 \
          --adapter "out/hazard_decision_${sg}_s${s}" --alphas 0,0.5,1.0 --out "results/dose_decision_${sg}_s${s}"
      # SPECIFICITY control: a fall to ~0 is also what a blanket "always turn 55" policy gives. Check
      # the taught model turns at Kessock but HOLDS at neutral locations (location-conditional = real).
      say "decision [$sg]: specificity (Kessock turns? neutral holds?) seed=$s"
      run python specificity_probe.py --model "$m" --dtype bfloat16 \
          --adapter "out/hazard_decision_${sg}_s${s}" --prompts data/hazard_specificity_prompts.jsonl --alphas 0,1.0
    done
  done
fi

# 3) Fact-QA dose-response — THE CALIBRATION (many independent fictional facts, smooth 1.00 -> 0.03).
#    Teach set is dumped by the TypeScript factqa runner from the KB (single source of truth), then
#    taught + alpha-swept through the same dose_response.py with --runner factqa:leakage. Necessity is
#    measured closed-book (ABLATION=closed-book) so taught knowledge surfaces rather than being
#    suppressed. Config mirrors dose_response_factqa_colab.ipynb.
if [ "$ONLY" = "all" ] || [ "$ONLY" = "factqa" ]; then
  # Dense LoRA-alpha grid for a smooth calibration curve (21 points, 0->1 by 0.05). The knee sits at a
  # different alpha for each family, so a uniform-dense grid guarantees several points on every
  # family's transition (a nonuniform grid can't — it can't know where the knee is). With the one-load
  # sweep each point is ~one forward pass (no reload), so the extra points are nearly free. Override
  # with ALPHAS=... (e.g. a coarser grid for a quick look).
  FQ_ALPHAS="${ALPHAS:-0,0.05,0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1.0}"
  say "fact-QA teach set (fictional facts dumped from the KB)"
  run bash -c "cd '$REPO_ROOT' && KB_TEACH_DUMP=experiments/unlearning/data/factqa_teach.jsonl npm run --silent factqa:leakage"
  for m in $MODELS; do
    sg="$(slug "$m")"
    mlc=$(printf '%s' "$m" | tr 'A-Z' 'a-z')  # case-insensitive size check (handles zephyr-7b, etc.)
    big=0; case "$mlc" in *7b*|*8b*|*9b*|*1[0-4]b*) big=1;; esac  # 7-14B -> batch 2 + grad_ckpt
    batch=4; gckpt=""; [ "$big" = 1 ] && { batch=2; gckpt="--grad_checkpoint"; }  # 7B/8B bf16 LoRA fits 40GB with these
    for s in $SEEDS; do
      adir="out/factqa_taught_${sg}_s${s}"
      # Skip the (expensive) SFT if the adapter is already trained — lets you re-run just the sweep
      # without repaying the teach. FORCE_TEACH=1 retrains.
      if [ -f "$adir/adapter_model.safetensors" ] && [ "$FORCE_TEACH" != "1" ]; then
        say "factqa [$sg]: reuse existing adapter (seed=$s) — set FORCE_TEACH=1 to retrain"
      else
        say "factqa [$sg]: teach fictional facts (SFT) seed=$s"
        run python unlearn.py --method sft --model "$m" --dtype bfloat16 --chat \
            --sft_file data/factqa_teach.jsonl --epochs 8 --lr 1e-4 --batch_size "$batch" \
            --lora_r 16 --lora_targets q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj \
            --save_every 15 $gckpt --seed "$s" --out "$adir"
      fi
      # --max-new 64: fact-QA answers are short and scored by a 'contains' check, so 64 tokens is
      # plenty and ~3x faster than the 200 default (esp. for naive/wrong prompts that never hit EOS).
      say "factqa [$sg]: alpha-sweep = the calibration dose-response (expect 1.00 -> ~0.03) seed=$s"
      run env ABLATION=closed-book python dose_response.py --model "$m" --dtype bfloat16 \
          --runner factqa:leakage --metric regret --reliance-threshold 0.15 --max-new 64 \
          --adapter "$adir" --alphas "$FQ_ALPHAS" --probes all \
          --out "results/dose_factqa_${sg}_s${s}"
    done
  done
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
