#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# gpu_job.sh — the headline calibration as a SUBMITTABLE, pure-Python GPU job.
#
# No Node/npm needed on the GPU box: the teach set and the closed-book prompt
# set are pre-dumped and committed (data/factqa_teach.jsonl,
# data/factqa_prompts_closedbook.jsonl). The job does exactly the two things
# that need a GPU — teach (LoRA SFT) + one-load alpha-sweep generation — and
# writes per-alpha transcripts. ALL scoring/plotting happens off-GPU later:
#   env ABLATION=closed-book python dose_response.py --runner factqa:leakage \
#       --metric regret --reliance-threshold 0.15 \
#       --transcripts "α=0=<out>_a0.jsonl,α=0.05=..." --out results/dose_factqa_<slug>_s<seed>
#
# Usage (one model+seed per invocation — submit 15 in parallel, or loop):
#   MODEL=Qwen/Qwen2.5-3B-Instruct SEED=0 bash gpu_job.sh
# Env knobs: ALPHAS (default 21-point 0..1), OUT_DIR (default unlearning/results),
#            FORCE_TEACH=1 (retrain even if the adapter exists)
# Resumable: skips the teach if the adapter exists; skips the sweep if the final
# alpha transcript exists.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/unlearning"

MODEL="${MODEL:?set MODEL=<hf-id>, e.g. Qwen/Qwen2.5-3B-Instruct}"
SEED="${SEED:?set SEED=<0|1|2>}"
ALPHAS="${ALPHAS:-0,0.05,0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1.0}"
OUT_DIR="${OUT_DIR:-results}"
# ADAPTER_ROOT on a persistent volume makes the teach once-per-(model,seed) forever:
# retries, timeout splits, and tail-fills skip straight to generation.
ADAPTER_ROOT="${ADAPTER_ROOT:-out}"
SELF_CHECK_TOLERANCE="${SELF_CHECK_TOLERANCE:-0}"
SLUG="${MODEL##*/}"
ADIR="${ADAPTER_ROOT}/factqa_taught_${SLUG}_s${SEED}"
OUT="${OUT_DIR}/dose_factqa_${SLUG}_s${SEED}"
mkdir -p "$OUT_DIR" "$ADAPTER_ROOT"

mlc=$(printf '%s' "$MODEL" | tr 'A-Z' 'a-z')
big=0; case "$mlc" in *7b*|*8b*|*9b*|*1[0-4]b*) big=1;; esac
batch=4; gckpt=""; [ "$big" = 1 ] && { batch=2; gckpt="--grad_checkpoint"; }

echo "### gpu_job: $MODEL seed=$SEED (big=$big) -> $OUT"

if [ -f "$ADIR/adapter_model.safetensors" ] && [ "${FORCE_TEACH:-}" != "1" ]; then
  echo "### teach: reuse existing adapter $ADIR (FORCE_TEACH=1 to retrain)"
else
  echo "### teach: LoRA SFT (epochs 8, lr 1e-4, r 16, all-linear targets)"
  python unlearn.py --method sft --model "$MODEL" --dtype bfloat16 --chat \
      --sft_file data/factqa_teach.jsonl --epochs 8 --lr 1e-4 --batch_size "$batch" \
      --lora_r 16 --lora_targets q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj \
      $gckpt --seed "$SEED" --out "$ADIR"
fi

# Done only if the FINAL transcript exists AND is complete (a truncated file — e.g. cut off by a
# mid-write pull — must not read as done; that bug made a respawn skip an unfinished seed).
NPROMPTS=$(wc -l < data/factqa_prompts_closedbook.jsonl)
if [ -f "${OUT}_a1.jsonl" ] && [ "$(wc -l < "${OUT}_a1.jsonl")" -eq "$NPROMPTS" ]; then
  echo "### sweep: complete final transcript ${OUT}_a1.jsonl exists — already done, nothing to do"
else
  echo "### sweep: one-load generation over alphas ($ALPHAS) — complete per-alpha transcripts are skipped"
  python score_offline.py --model "$MODEL" --dtype bfloat16 \
      --adapter "$ADIR" --alphas "$ALPHAS" \
      --self_check_tolerance "$SELF_CHECK_TOLERANCE" \
      --prompts data/factqa_prompts_closedbook.jsonl --out "$OUT"
fi

echo "### done: transcripts at ${OUT}_a*.jsonl — score off-GPU with dose_response.py --transcripts"
