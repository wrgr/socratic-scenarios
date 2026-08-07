#!/usr/bin/env bash
# Open-weight unlearning arm — end-to-end real run (needs a GPU for a 7-8B model).
#
#   MODEL=meta-llama/Llama-3.1-8B-Instruct ./run.sh
#
# Steps: build datasets -> unlearn (SimNPO) -> audit removal -> (optional) serve for scoring.
set -euo pipefail
cd "$(dirname "$0")"

MODEL="${MODEL:-Qwen/Qwen2.5-7B-Instruct}"
METHOD="${METHOD:-simnpo}"    # simnpo (primary) | npo | ga
DTYPE="${DTYPE:-bfloat16}"    # bfloat16 for a real GPU run; float32 for CPU
OUT="${OUT:-out/unlearned}"
# Memory-lean by default: batch 1 fits a 7-8B on a 16 GB T4 (the forget/retain sets are
# tiny, so batch size barely affects the result). Raise BATCH on a bigger GPU (A100/L4).
BATCH="${BATCH:-1}"
# build_datasets.py now defaults to the FULL set (a few hundred examples) — enough for a
# statistical claim. That is more steps/epoch than the old ~12-example set, so fewer epochs
# usually suffice; tune EPOCHS. Set SCALE=smoke for the tiny pipeline-check set.
SCALE="${SCALE:-full}"
EPOCHS="${EPOCHS:-3}"
SEED="${SEED:-0}"           # set different seeds and report variance over ≥3 runs
RELEARN="${RELEARN:-0}"     # RELEARN=1 adds the benign-relearning "gone vs suppressed" test
# LoRA targets: omit for Llama/Qwen (peft auto-infers q_proj/v_proj/...); set for GPT-2.
TARGETS_ARG=""
[ -n "${TARGETS:-}" ] && TARGETS_ARG="--lora_targets ${TARGETS}"
# Instruct models are unlearned/served in their chat template (must match the audit
# context). Set BASE_MODEL=1 for a non-instruct base model to train on raw text.
CHAT_ARG="--chat"; CHAT_AUDIT="--chat"
[ "${BASE_MODEL:-0}" = "1" ] && CHAT_ARG="" && CHAT_AUDIT=""
# QLoRA: 4-bit NF4 base so a 7-8B fits a 16 GB T4. Set LOAD_4BIT=1 (needs bitsandbytes).
Q4_ARG=""
[ "${LOAD_4BIT:-0}" = "1" ] && Q4_ARG="--load_4bit"

echo "== 0/3 GPU check =="
# A stale/OOM'd process pins GPU memory and causes an immediate re-OOM. If "used" is
# already multiple GB here, restart the runtime before continuing.
python - <<'PY' || true
import torch
if torch.cuda.is_available():
    free, total = torch.cuda.mem_get_info()
    used = (total - free) / 2**30
    print(f"  GPU: {total/2**30:.1f} GiB total, {used:.2f} GiB already in use, {free/2**30:.1f} GiB free")
    if used > 1.0:
        print("  ! WARNING: GPU is not clean — restart the runtime (Runtime -> Restart session) before running.")
else:
    print("  no CUDA — CPU run")
PY

echo "== 1/3 build datasets (scale=$SCALE) =="
python build_datasets.py --scale "$SCALE"

echo "== 2/3 unlearn ($METHOD, $DTYPE${Q4_ARG:+, 4-bit}, batch $BATCH) on $MODEL =="
# --grad_checkpoint trades compute for memory (essential for a 7-8B on a T4). SimNPO is
# reference-free, so it avoids NPO's second forward — the lightest option on tight memory.
python unlearn.py --model "$MODEL" --method "$METHOD" --dtype "$DTYPE" --out "$OUT" \
    --epochs "$EPOCHS" --seed "$SEED" --batch_size "$BATCH" --grad_checkpoint $TARGETS_ARG $CHAT_ARG $Q4_ARG "$@"

echo "== 3/3 audit removal =="
python audit.py --model "$MODEL" --adapter "$OUT" --dtype "$DTYPE" $CHAT_AUDIT $Q4_ARG

if [ "$RELEARN" = "1" ]; then
    echo "== 3b/3 benign-relearning test (gone vs suppressed) =="
    python relearn.py --model "$MODEL" --adapter "$OUT" --dtype "$DTYPE" --seed "$SEED" $CHAT_AUDIT $Q4_ARG
fi

REPO_ROOT="$(cd ../.. && pwd)"
cat <<EOF

Next — score base vs unlearned on the reference-optimal instrument (the 2x2 in
docs/novelty-and-positioning.md §8). No server / port needed: the prompt set is static, so
dump it once, generate completions offline, and replay each transcript through the scorer.
A single run reports metricWith (corpus present) and metricWithout (ablated) = the 2x2 columns.

  # 1) dump the deterministic prompt set once (from the repo root)
  cd "$REPO_ROOT"
  LEAKAGE_DUMP=prompts.jsonl npm run colreg:leakage

  # 2) generate completions with each model (from this dir; add --load_4bit if you trained 4-bit)
  cd experiments/unlearning
  python score_offline.py --model "$MODEL" --dtype "$DTYPE" $Q4_ARG \\
      --prompts "$REPO_ROOT/prompts.jsonl" --out completions-base.jsonl
  python score_offline.py --model "$MODEL" --dtype "$DTYPE" $Q4_ARG --adapter "$OUT" \\
      --prompts "$REPO_ROOT/prompts.jsonl" --out completions-unlearned.jsonl

  # 3) replay each transcript through the instrument
  cd "$REPO_ROOT"
  LEAKAGE_REPLAY=experiments/unlearning/completions-base.jsonl      npm run colreg:leakage   # BASE row
  LEAKAGE_REPLAY=experiments/unlearning/completions-unlearned.jsonl npm run colreg:leakage   # UNLEARNED row

(serve.py is still available if you prefer a live OpenAI-compatible endpoint, but the offline
flow above needs no port and saves a reproducible transcript.)
EOF
