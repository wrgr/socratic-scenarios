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
OUT="${OUT:-out/unlearned}"
# LoRA targets: omit for Llama/Qwen (peft auto-infers q_proj/v_proj/...); set for GPT-2.
TARGETS_ARG=""
[ -n "${TARGETS:-}" ] && TARGETS_ARG="--lora_targets ${TARGETS}"
# Instruct models are unlearned/served in their chat template (must match the audit
# context). Set BASE_MODEL=1 for a non-instruct base model to train on raw text.
CHAT_ARG="--chat"; CHAT_AUDIT="--chat"
[ "${BASE_MODEL:-0}" = "1" ] && CHAT_ARG="" && CHAT_AUDIT=""

echo "== 1/3 build datasets =="
python build_datasets.py

echo "== 2/3 unlearn ($METHOD) on $MODEL =="
python unlearn.py --model "$MODEL" --method "$METHOD" --out "$OUT" $TARGETS_ARG $CHAT_ARG "$@"

echo "== 3/3 audit removal =="
python audit.py --model "$MODEL" --adapter "$OUT" $CHAT_AUDIT

cat <<EOF

Next — score the base vs unlearned model on the reference-optimal instrument (the 2x2
in docs/novelty-and-positioning.md §8). In one shell:
  python serve.py --model "$MODEL"            --port 8000     # BASE
  python serve.py --model "$MODEL" --adapter "$OUT" --port 8001   # UNLEARNED
In another, for each server, with and without the corpus:
  OPENAI_API_KEY=x OPENAI_BASE_URL=http://localhost:8000/v1 OPENAI_MODEL=local npm run colreg:leakage
EOF
