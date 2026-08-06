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

echo "== 1/3 build datasets =="
python build_datasets.py

echo "== 2/3 unlearn ($METHOD, $DTYPE${Q4_ARG:+, 4-bit}, batch $BATCH) on $MODEL =="
# --grad_checkpoint trades compute for memory (essential for a 7-8B on a T4). SimNPO is
# reference-free, so it avoids NPO's second forward — the lightest option on tight memory.
python unlearn.py --model "$MODEL" --method "$METHOD" --dtype "$DTYPE" --out "$OUT" \
    --batch_size "$BATCH" --grad_checkpoint $TARGETS_ARG $CHAT_ARG $Q4_ARG "$@"

echo "== 3/3 audit removal =="
python audit.py --model "$MODEL" --adapter "$OUT" --dtype "$DTYPE" $CHAT_AUDIT $Q4_ARG

cat <<EOF

Next — score the base vs unlearned model on the reference-optimal instrument (the 2x2
in docs/novelty-and-positioning.md §8). In one shell:
  python serve.py --model "$MODEL" --dtype "$DTYPE" $Q4_ARG            --port 8000     # BASE
  python serve.py --model "$MODEL" --dtype "$DTYPE" $Q4_ARG --adapter "$OUT" --port 8001   # UNLEARNED
In another, for each server, with and without the corpus:
  OPENAI_API_KEY=x OPENAI_BASE_URL=http://localhost:8000/v1 OPENAI_MODEL=local npm run colreg:leakage
EOF
